// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ParcelRegistry — canonical record of each tokenized land parcel
/// @notice Stores parcel metadata on-chain; only an authorized verifier can register parcels
contract ParcelRegistry is Ownable {
    struct Parcel {
        uint256 id;
        bytes32 geoHash;
        bytes32 docHash;
        uint16 confidenceScore;
        uint256 totalShares;
        address seller;
        bool verified;
    }

    uint256 public nextParcelId = 1;
    mapping(uint256 => Parcel) public parcels;
    mapping(address => bool) public verifiers;

    error NotVerifier();
    error ParcelNotFound(uint256 id);
    error InvalidConfidence(uint16 score);
    error ZeroShares();

    event ParcelRegistered(
        uint256 indexed id,
        address indexed seller,
        bytes32 geoHash,
        bytes32 docHash,
        uint16 confidenceScore,
        uint256 totalShares
    );
    event VerifierUpdated(address indexed verifier, bool status);

    modifier onlyVerifier() {
        if (!verifiers[msg.sender]) revert NotVerifier();
        _;
    }

    constructor() Ownable(msg.sender) {
        verifiers[msg.sender] = true;
    }

    /// @notice Add or remove a verifier address (backend signer)
    function setVerifier(address _verifier, bool _status) external onlyOwner {
        verifiers[_verifier] = _status;
        emit VerifierUpdated(_verifier, _status);
    }

    /// @notice Register a new parcel after AI verification approval
    /// @param geoHash Hash of geo-coordinates/polygon
    /// @param docHash Hash of the verified title deed
    /// @param confidenceScore AI confidence 0-100
    /// @param totalShares Number of fractional shares
    /// @param seller Address of the land seller
    /// @return parcelId The newly created parcel ID
    function registerParcel(
        bytes32 geoHash,
        bytes32 docHash,
        uint16 confidenceScore,
        uint256 totalShares,
        address seller
    ) external onlyVerifier returns (uint256 parcelId) {
        if (confidenceScore > 100) revert InvalidConfidence(confidenceScore);
        if (totalShares == 0) revert ZeroShares();

        parcelId = nextParcelId++;
        parcels[parcelId] = Parcel({
            id: parcelId,
            geoHash: geoHash,
            docHash: docHash,
            confidenceScore: confidenceScore,
            totalShares: totalShares,
            seller: seller,
            verified: true
        });

        emit ParcelRegistered(parcelId, seller, geoHash, docHash, confidenceScore, totalShares);
    }

    /// @notice Get parcel data
    function getParcel(uint256 id) external view returns (Parcel memory) {
        if (parcels[id].id == 0) revert ParcelNotFound(id);
        return parcels[id];
    }
}
