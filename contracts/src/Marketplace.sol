// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ShareToken.sol";

/// @title Marketplace — primary sales, secondary listings, and direct offers with escrow
/// @notice All payments in native MNT. Supports simultaneous per-holder offers for acquisition flow.
contract Marketplace is ReentrancyGuard {
    ShareToken public immutable shareToken;

    // --- Secondary Listings ---
    struct Listing {
        address seller;
        uint256 parcelId;
        uint256 amount;
        uint256 pricePerShare;
        bool active;
    }

    uint256 public nextListingId = 1;
    mapping(uint256 => Listing) public listings;

    // --- Direct Offers with Escrow ---
    struct Offer {
        address buyer;
        address targetHolder;
        uint256 parcelId;
        uint256 amount;
        uint256 pricePerShare;
        uint256 expiry;
        bool active;
    }

    uint256 public nextOfferId = 1;
    mapping(uint256 => Offer) public offers;

    // --- Primary Sale Config ---
    struct PrimarySale {
        address seller;
        uint256 pricePerShare;
        bool active;
    }
    mapping(uint256 => PrimarySale) public primarySales;

    error InsufficientPayment();
    error NotSeller();
    error NotTargetHolder();
    error ListingNotActive();
    error OfferNotActive();
    error OfferExpired();
    error OfferNotExpired();
    error NotBuyer();
    error PrimarySaleNotActive();
    error InsufficientShares();
    error ZeroAmount();

    event PrimarySaleCreated(uint256 indexed parcelId, address indexed seller, uint256 pricePerShare);
    event PrimaryPurchase(uint256 indexed parcelId, address indexed buyer, uint256 amount, uint256 totalPaid);
    event ListingCreated(uint256 indexed listingId, uint256 indexed parcelId, address indexed seller, uint256 amount, uint256 pricePerShare);
    event ListingFilled(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 totalPaid);
    event ListingCancelled(uint256 indexed listingId);
    event OfferCreated(uint256 indexed offerId, uint256 indexed parcelId, address indexed buyer, address targetHolder, uint256 amount, uint256 pricePerShare);
    event OfferAccepted(uint256 indexed offerId);
    event OfferRejected(uint256 indexed offerId);
    event OfferRefunded(uint256 indexed offerId);

    constructor(address _shareToken) {
        shareToken = ShareToken(_shareToken);
    }

    // ============ Primary Sale ============

    /// @notice Seller sets up a primary sale for their parcel shares
    function createPrimarySale(uint256 parcelId, uint256 pricePerShare) external {
        primarySales[parcelId] = PrimarySale({
            seller: msg.sender,
            pricePerShare: pricePerShare,
            active: true
        });
        emit PrimarySaleCreated(parcelId, msg.sender, pricePerShare);
    }

    /// @notice Buy shares from the seller's primary pool
    function buyPrimary(uint256 parcelId, uint256 amount) external payable nonReentrant {
        PrimarySale storage sale = primarySales[parcelId];
        if (!sale.active) revert PrimarySaleNotActive();
        if (amount == 0) revert ZeroAmount();

        uint256 totalCost = amount * sale.pricePerShare;
        if (msg.value < totalCost) revert InsufficientPayment();

        uint256 sellerBalance = shareToken.balanceOf(sale.seller, parcelId);
        if (sellerBalance < amount) revert InsufficientShares();

        // Transfer shares from seller to buyer
        shareToken.safeTransferFrom(sale.seller, msg.sender, parcelId, amount, "");

        // Forward MNT to seller
        (bool sent,) = payable(sale.seller).call{value: totalCost}("");
        require(sent, "MNT transfer failed");

        // Refund excess
        if (msg.value > totalCost) {
            (bool refunded,) = payable(msg.sender).call{value: msg.value - totalCost}("");
            require(refunded, "Refund failed");
        }

        emit PrimaryPurchase(parcelId, msg.sender, amount, totalCost);
    }

    // ============ Secondary Listings ============

    /// @notice List shares for sale on the secondary market
    function createListing(uint256 parcelId, uint256 amount, uint256 pricePerShare) external {
        if (amount == 0) revert ZeroAmount();
        uint256 balance = shareToken.balanceOf(msg.sender, parcelId);
        if (balance < amount) revert InsufficientShares();

        uint256 listingId = nextListingId++;
        listings[listingId] = Listing({
            seller: msg.sender,
            parcelId: parcelId,
            amount: amount,
            pricePerShare: pricePerShare,
            active: true
        });

        emit ListingCreated(listingId, parcelId, msg.sender, amount, pricePerShare);
    }

    /// @notice Fill a secondary listing
    function fillListing(uint256 listingId, uint256 amount) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        if (!listing.active) revert ListingNotActive();
        if (amount == 0) revert ZeroAmount();
        if (amount > listing.amount) revert InsufficientShares();

        uint256 totalCost = amount * listing.pricePerShare;
        if (msg.value < totalCost) revert InsufficientPayment();

        listing.amount -= amount;
        if (listing.amount == 0) listing.active = false;

        shareToken.safeTransferFrom(listing.seller, msg.sender, listing.parcelId, amount, "");

        (bool sent,) = payable(listing.seller).call{value: totalCost}("");
        require(sent, "MNT transfer failed");

        if (msg.value > totalCost) {
            (bool refunded,) = payable(msg.sender).call{value: msg.value - totalCost}("");
            require(refunded, "Refund failed");
        }

        emit ListingFilled(listingId, msg.sender, amount, totalCost);
    }

    /// @notice Cancel your own listing
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        if (listing.seller != msg.sender) revert NotSeller();
        if (!listing.active) revert ListingNotActive();
        listing.active = false;
        emit ListingCancelled(listingId);
    }

    // ============ Direct Offers with Escrow ============

    /// @notice Place an offer targeting a specific holder, locking MNT in escrow (72h expiry)
    function createOffer(
        uint256 parcelId,
        address targetHolder,
        uint256 amount,
        uint256 pricePerShare
    ) external payable nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 totalCost = amount * pricePerShare;
        if (msg.value < totalCost) revert InsufficientPayment();

        uint256 offerId = nextOfferId++;
        offers[offerId] = Offer({
            buyer: msg.sender,
            targetHolder: targetHolder,
            parcelId: parcelId,
            amount: amount,
            pricePerShare: pricePerShare,
            expiry: block.timestamp + 72 hours,
            active: true
        });

        // Refund excess
        if (msg.value > totalCost) {
            (bool refunded,) = payable(msg.sender).call{value: msg.value - totalCost}("");
            require(refunded, "Refund failed");
        }

        emit OfferCreated(offerId, parcelId, msg.sender, targetHolder, amount, pricePerShare);
    }

    /// @notice Accept an offer — atomic swap: shares to buyer, MNT to holder
    function acceptOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        if (!offer.active) revert OfferNotActive();
        if (msg.sender != offer.targetHolder) revert NotTargetHolder();
        if (block.timestamp > offer.expiry) revert OfferExpired();

        offer.active = false;
        uint256 totalPay = offer.amount * offer.pricePerShare;

        // Transfer shares from holder to buyer
        shareToken.safeTransferFrom(offer.targetHolder, offer.buyer, offer.parcelId, offer.amount, "");

        // Release escrow to holder
        (bool sent,) = payable(offer.targetHolder).call{value: totalPay}("");
        require(sent, "MNT transfer failed");

        emit OfferAccepted(offerId);
    }

    /// @notice Reject an offer — refund escrow to buyer
    function rejectOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        if (!offer.active) revert OfferNotActive();
        if (msg.sender != offer.targetHolder) revert NotTargetHolder();

        offer.active = false;
        uint256 totalRefund = offer.amount * offer.pricePerShare;

        (bool sent,) = payable(offer.buyer).call{value: totalRefund}("");
        require(sent, "Refund failed");

        emit OfferRejected(offerId);
    }

    /// @notice Claim refund on an expired offer
    function claimExpiredOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        if (!offer.active) revert OfferNotActive();
        if (msg.sender != offer.buyer) revert NotBuyer();
        if (block.timestamp <= offer.expiry) revert OfferNotExpired();

        offer.active = false;
        uint256 totalRefund = offer.amount * offer.pricePerShare;

        (bool sent,) = payable(offer.buyer).call{value: totalRefund}("");
        require(sent, "Refund failed");

        emit OfferRefunded(offerId);
    }

    /// @notice Required to receive ERC1155 tokens
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
