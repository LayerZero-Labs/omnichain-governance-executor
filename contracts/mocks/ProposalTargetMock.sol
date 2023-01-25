// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;

contract ProposalTargetMock {
    uint public fee;

    function setFee(uint _fee) external {
        fee = _fee;
    }
}
