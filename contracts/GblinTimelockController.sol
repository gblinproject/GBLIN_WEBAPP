// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title GblinTimelockController
 * @author GBLIN Protocol
 * @notice 48-hour Timelock that owns GBLIN_GlobalBalancedLiquidityIndex.
 *         Enables governance transitions (EOA <-> DAO <-> EOA) with a guaranteed
 *         48h delay. Designed to maximize on-chain verifiability and AI-agent trust.
 * @dev Thin wrapper on top of OpenZeppelin TimelockController v5.6:
 *      - MIN_DELAY hardcoded to 48h (immutable, no rug-then-attack vector).
 *      - GRACE_PERIOD of 14 days (Compound-style): operations expire if not executed
 *        within `eta + GRACE_PERIOD`, preventing zombie proposals.
 *      - EXECUTOR_ROLE granted to address(0) -> any address can execute a matured op
 *        (anti-censorship + gas-efficient, OZ + Compound standard pattern).
 *      - CANCELLER_ROLE explicitly separated from PROPOSER_ROLE: only the dedicated
 *        guardian multisig can veto pending operations.
 *      - DEFAULT_ADMIN_ROLE held by the timelock itself (self-administered): every
 *        role / config change must itself go through the 48h delay.
 * @custom:target 0x38DcDB3A381677239BBc652aed9811F2f8496345 (GBLIN_V5 on Base mainnet)
 * @custom:website https://gblin.digital
 */
contract GblinTimelockController is TimelockController {

    // --- CONSTANTS ---

    /// @notice Minimum delay for every scheduled operation. Hardcoded for transparency.
    /// @dev Public constant so it is discoverable via MCP servers and block explorers.
    uint256 public constant GBLIN_MIN_DELAY = 48 hours;

    /// @notice Grace window after `eta`. After this, the operation expires and must be re-scheduled.
    /// @dev Mirrors Compound Bravo behaviour and prevents long-pending zombie proposals.
    uint256 public constant GRACE_PERIOD = 14 days;

    /// @notice Human-readable version tag.
    string public constant VERSION = "GblinTimelock-1.0";

    // --- ERRORS ---

    /// @notice Thrown when an operation is executed after `eta + GRACE_PERIOD`.
    /// @param id The operation id that has expired.
    /// @param expiredAt The timestamp at which the operation expired.
    error OperationExpired(bytes32 id, uint256 expiredAt);

    /// @notice Thrown when the constructor receives an empty proposers array.
    error NoProposers();

    /// @notice Thrown when the constructor receives an empty cancellers array.
    error NoCancellers();

    /// @notice Thrown when address(0) is passed in `proposers` or `cancellers`.
    /// @dev Granting a role to address(0) would make it an "open role" (anyone),
    ///      which would defeat the purpose of separation of powers.
    error ZeroAddressInRoles();

    /// @notice Thrown when an address is supplied in both `proposers` and `cancellers`.
    /// @param account The conflicting address.
    /// @dev Power separation invariant: a canceller must NOT also be a proposer.
    error ProposerCannotBeCanceller(address account);

    // --- CONSTRUCTOR ---

    /**
     * @notice Deploys a self-administered 48h Timelock for GBLIN governance.
     * @param proposers Addresses authorised to schedule and cancel-via-self operations
     *                  (typically the current EOA owner; later a DAO governor).
     * @param cancellers Addresses with veto power over pending operations
     *                   (typically a Gnosis Safe 2/3 guardian multisig).
     * @dev `admin` is forced to `address(0)` -> the timelock administers itself.
     *      Do NOT pass an EOA as admin: it would defeat the purpose of the delay.
     */
    constructor(
        address[] memory proposers,
        address[] memory cancellers
    )
        TimelockController(
            GBLIN_MIN_DELAY,
            proposers,
            _openExecutorArray(),
            address(0)
        )
    {
        if (proposers.length == 0) revert NoProposers();
        if (cancellers.length == 0) revert NoCancellers();

        // Hardening #1: reject zero-address in any role array.
        // A role granted to address(0) becomes an "open role" (anyone), which
        // would silently destroy the security model.
        for (uint256 i = 0; i < proposers.length; i++) {
            if (proposers[i] == address(0)) revert ZeroAddressInRoles();
        }
        for (uint256 j = 0; j < cancellers.length; j++) {
            if (cancellers[j] == address(0)) revert ZeroAddressInRoles();
        }

        // OZ TimelockController grants CANCELLER_ROLE to every proposer by default.
        // We explicitly revoke it and re-grant it only to the dedicated cancellers,
        // enforcing strict power separation (proposer != canceller).
        bytes32 cancellerRole = CANCELLER_ROLE;
        for (uint256 i = 0; i < proposers.length; i++) {
            _revokeRole(cancellerRole, proposers[i]);
        }

        // Hardening #2: reject overlap between proposers and cancellers.
        // An address with both roles defeats the separation-of-powers invariant
        // (a single key compromise would yield full control over the timelock).
        for (uint256 j = 0; j < cancellers.length; j++) {
            if (hasRole(PROPOSER_ROLE, cancellers[j])) {
                revert ProposerCannotBeCanceller(cancellers[j]);
            }
            _grantRole(cancellerRole, cancellers[j]);
        }
    }

    // --- INTERNAL HELPERS ---

    /// @dev Returns a single-element array containing `address(0)`, which OZ
    ///      TimelockController interprets as "open execution by anyone".
    function _openExecutorArray() private pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = address(0);
    }

    // --- OVERRIDES: GRACE PERIOD ENFORCEMENT ---

    /**
     * @inheritdoc TimelockController
     * @dev Adds a Compound-style grace period: an operation cannot be executed
     *      after `scheduledTimestamp + GRACE_PERIOD`.
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata payload,
        bytes32 predecessor,
        bytes32 salt
    ) public payable virtual override {
        bytes32 id = hashOperation(target, value, payload, predecessor, salt);
        _checkNotExpired(id);
        super.execute(target, value, payload, predecessor, salt);
    }

    /**
     * @inheritdoc TimelockController
     * @dev Adds the same grace period check to batched executions.
     */
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt
    ) public payable virtual override {
        bytes32 id = hashOperationBatch(targets, values, payloads, predecessor, salt);
        _checkNotExpired(id);
        super.executeBatch(targets, values, payloads, predecessor, salt);
    }

    /// @dev Reverts with {OperationExpired} if `id` is past its grace window.
    function _checkNotExpired(bytes32 id) private view {
        uint256 ts = getTimestamp(id);
        if (ts != 0 && block.timestamp > ts + GRACE_PERIOD) {
            revert OperationExpired(id, ts + GRACE_PERIOD);
        }
    }

    // --- OVERRIDES: SECURITY ENFORCEMENT ---

    /**
     * @notice Permanently disabled. The minimum delay is fixed at 48 hours.
     * @dev Overrides OZ {TimelockController-updateDelay} to revert unconditionally.
     *      Mitigates rug-then-attack scenarios where an admin lowers the delay and
     *      immediately exploits a previously-restricted function. To change the
     *      delay, a new Timelock must be deployed and ownership migrated via the
     *      existing 48h-delayed `transferOwnership` flow.
     */
    function updateDelay(uint256) public pure override {
        revert("GblinTimelock: delay is strictly immutable");
    }
}
