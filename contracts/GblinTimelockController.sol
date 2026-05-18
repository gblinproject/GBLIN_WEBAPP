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

        // OZ TimelockController grants CANCELLER_ROLE to every proposer by default.
        // We explicitly revoke it and re-grant it only to the dedicated cancellers,
        // enforcing strict power separation (proposer != canceller).
        bytes32 cancellerRole = CANCELLER_ROLE;
        for (uint256 i = 0; i < proposers.length; i++) {
            _revokeRole(cancellerRole, proposers[i]);
        }
        for (uint256 i = 0; i < cancellers.length; i++) {
            _grantRole(cancellerRole, cancellers[i]);
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
     * @dev Disabilita nativamente la funzione updateDelay di OpenZeppelin.
     * Il delay minimo di GBLIN e hardcoded a 48h in modo permanente per
     * garantire massima sicurezza istituzionale.
     *
     * Razionale: previene attacchi "rug-then-attack" (un admin malevolo che
     * propone l azzeramento del delay e, successivamente, altera l oracle
     * all istante). Se mai servisse un delay differente, la prassi corretta
     * e migrare verso un nuovo contratto Timelock via 48h delay, non
     * modificare a caldo una variabile critica.
     */
    function updateDelay(uint256) external pure override {
        revert("GblinTimelock: delay is strictly immutable");
    }
}
