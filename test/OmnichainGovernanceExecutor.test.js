const { expect } = require("chai")
const { ethers } = require("hardhat")
const { utils, constants } = require("ethers")

describe("OmnichainGovernanceExecution", () => {
    const proposalSenderChainId = 1
    const remoteExecutorChainId = 2
    const remoteExecutorTargetFee = 200

    let owner
    let governorBravo, timelock, proposalSender, remoteExecutor
    let remoteProposalActions, remoteExecutorTarget
    let payload, fee
    let adapterParams = "0x"
    let targets, values, signatures, calldatas
    let proposalId

    before(async () => {
        ;[owner, user] = await ethers.getSigners()
    })

    beforeEach(async () => {
        const endpointFactory = await ethers.getContractFactory("LayerZeroEndpoint")
        proposalSenderEndpoint = await endpointFactory.deploy(proposalSenderChainId)
        remoteExecutorEndpoint = await endpointFactory.deploy(remoteExecutorChainId)

        const timelockFactory = await ethers.getContractFactory("TimelockMock")
        timelock = await timelockFactory.deploy()

        const governorBravoFactory = await ethers.getContractFactory("GovernorBravoMock")
        governorBravo = await governorBravoFactory.deploy(timelock.address)

        const proposalSenderFactory = await ethers.getContractFactory("OmnichainProposalSender")
        proposalSender = await proposalSenderFactory.deploy(proposalSenderEndpoint.address)

        const remoteExecutorFactory = await ethers.getContractFactory("OmnichainGovernanceExecutor")
        remoteExecutor = await remoteExecutorFactory.deploy(remoteExecutorEndpoint.address)

        const proposalTargetFactory = await ethers.getContractFactory("ProposalTargetMock")
        remoteExecutorTarget = await proposalTargetFactory.deploy()

        proposalSenderEndpoint.setDestLzEndpoint(remoteExecutor.address, remoteExecutorEndpoint.address)
        remoteExecutorEndpoint.setDestLzEndpoint(proposalSender.address, proposalSenderEndpoint.address)

        // set each contracts source address so it can send to each other
        await proposalSender.setTrustedRemoteAddress(remoteExecutorChainId, remoteExecutor.address)
        await remoteExecutor.setTrustedRemoteAddress(proposalSenderChainId, proposalSender.address)

        await proposalSender.transferOwnership(timelock.address)

        payload = utils.defaultAbiCoder.encode(
            ["address[]", "uint256[]", "string[]", "bytes[]"],
            [[remoteExecutorTarget.address], [0], ["setFee(uint256)"], [utils.defaultAbiCoder.encode(["uint256"], [remoteExecutorTargetFee])]]
        )

        targets = [proposalSender.address]
        signatures = ["execute(uint16,bytes,bytes)"]
        calldatas = [utils.defaultAbiCoder.encode(["uint16", "bytes", "bytes"], [remoteExecutorChainId, payload, adapterParams])]

        fee = await proposalSender.estimateFees(remoteExecutorChainId, payload, adapterParams)
    })

    describe("propose with enough fees", () => {
        beforeEach(async () => {
            values = [fee.nativeFee]
            await governorBravo.propose(targets, values, signatures, calldatas)
            proposalId = await governorBravo.proposalCount()
        })

        it("executes the remote proposal", async () => {
            await governorBravo.execute(proposalId, { value: fee.nativeFee })
            expect((await remoteExecutorTarget.fee()).toNumber()).to.eq(remoteExecutorTargetFee)
        })
    })

    describe("propose with not enough fees", () => {
        beforeEach(async () => {
            values = [0]
            await governorBravo.propose(targets, values, signatures, calldatas)
            proposalId = await governorBravo.proposalCount()
        })

        describe("execution fails", () => {
            beforeEach(async () => {
                await governorBravo.execute(proposalId)
            })

            it("stores saved payload", async () => {
                await governorBravo.execute(proposalId)
                const nonce = await proposalSender.lastStoredPayloadNonce()
                const hash = await proposalSender.storedExecutionHashes(nonce)

                // not eq zero hash
                expect(hash).to.be.not.eq("0x0000000000000000000000000000000000000000000000000000000000000000")
            })

            it("clears the payload and executes the remote proposal", async () => {
                await governorBravo.execute(proposalId)
                const nonce = await proposalSender.lastStoredPayloadNonce()

                await proposalSender.retryExecute(nonce, remoteExecutorChainId, payload, adapterParams, values[0], { value: fee.nativeFee })
                expect((await remoteExecutorTarget.fee()).toNumber()).to.eq(remoteExecutorTargetFee)
            })
        })
    })
})
