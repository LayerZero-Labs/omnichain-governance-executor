// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./TimelockMock.sol";

contract GovernorBravoMock {
    /// @notice The official record of all proposals ever proposed
    mapping(uint => Proposal) public proposals;

    /// @notice The total number of proposals
    uint public proposalCount;

    TimelockMock public timelock;

    struct Proposal {
        /// @notice Unique id for looking up a proposal
        uint id;
        /// @notice the ordered list of target addresses for calls to be made
        address[] targets;
        /// @notice The ordered list of values (i.e. msg.value) to be passed to the calls to be made
        uint[] values;
        /// @notice The ordered list of function signatures to be called
        string[] signatures;
        /// @notice The ordered list of calldata to be passed to each call
        bytes[] calldatas;
    }

    constructor(address _timelock) {
        timelock = TimelockMock(_timelock);
    }

    function propose(address[] memory targets, uint[] memory values, string[] memory signatures, bytes[] memory calldatas) public returns (uint) {
        proposalCount++;
        uint newProposalID = proposalCount;
        Proposal storage newProposal = proposals[newProposalID];
        require(newProposal.id == 0, "GovernorBravo::propose: ProposalID collision");
        newProposal.targets = targets;
        newProposal.values = values;
        newProposal.signatures = signatures;
        newProposal.calldatas = calldatas;

        return newProposal.id;
    }

    function execute(uint proposalId) external payable {
        Proposal storage proposal = proposals[proposalId];
        for (uint i = 0; i < proposal.targets.length; i++) {
            timelock.executeTransaction{value: proposal.values[i]}(proposal.targets[i], proposal.values[i], proposal.signatures[i], proposal.calldatas[i]);
        }
    }
}
