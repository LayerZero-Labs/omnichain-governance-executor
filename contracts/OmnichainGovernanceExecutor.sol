// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";

/// @title Omnichain Governance Executor
/// @notice Executes the proposal transactions sent from the main chain
/// @dev The owner of this contract controls LayerZero configuration. When used in production the owner should be set to a Timelock or this contract itself 
/// This implementation is non-blocking meaning the failed messages will not block the future messages from the source. For the blocking behavior derive the contract from LzApp
contract OmnichainGovernanceExecutor is NonblockingLzApp, ReentrancyGuard {
    using BytesLib for bytes;
    using ExcessivelySafeCall for address;

    event MessageReceived(uint16 _srcChainId, bytes _srcAddress, uint64 _nonce, bytes payload);
    event MessageFailed(uint16 _srcChainId, bytes _srcAddress, uint64 _nonce, bytes _reason);
    event ProposalExecuted(bytes payload);

    constructor(address _endpoint) NonblockingLzApp(_endpoint) {}

    // overriding the virtual function in LzReceiver
    function _blockingLzReceive(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _payload) internal virtual override {
        failedMessages[_srcChainId][_srcAddress][_nonce] = keccak256(_payload);
        emit MessageReceived(_srcChainId, _srcAddress, _nonce, _payload);
        
        // Amount of gas required to emit MessageFailed event or delete failedMessages mapping value
        uint remainderGas = 6000;

        (bool success, bytes memory reason) = address(this).excessivelySafeCall(gasleft() - remainderGas, 150, abi.encodeWithSelector(this.nonblockingLzReceive.selector, _srcChainId, _srcAddress, _nonce, _payload));
        // try-catch all errors/exceptions
        if (success) {
            delete failedMessages[_srcChainId][_srcAddress][_nonce];
        }
        else {
            emit MessageFailed(_srcChainId, _srcAddress, _nonce, reason);
        }
    }

    /// @notice Executes the proposal
    /// @dev Called by LayerZero Endpoint when a message from the source is received
    function _nonblockingLzReceive(uint16, bytes memory, uint64, bytes memory _payload) internal virtual override {
        (address[] memory targets, uint[] memory values, string[] memory signatures, bytes[] memory calldatas) = abi.decode(_payload, (address[], uint[], string[], bytes[]));

        for (uint i = 0; i < targets.length; i++) {
            _executeTransaction(targets[i], values[i], signatures[i], calldatas[i]);
        }
        emit ProposalExecuted(_payload);
    }

    function _executeTransaction(address target, uint value, string memory signature, bytes memory data) private nonReentrant {
        bytes memory callData = bytes(signature).length == 0 ? data : abi.encodePacked(bytes4(keccak256(bytes(signature))), data);

        // solium-disable-next-line security/no-call-value
        (bool success, ) = target.call{value: value}(callData);
        require(success, "OmnichainGovernanceExecutor: transaction execution reverted");
    }  
    
    receive() external payable {}
}
