const { LZ_ADDRESS } = require("@layerzerolabs/lz-sdk");

module.exports = async function ({ deployments, getNamedAccounts }) {
	const { deploy } = deployments
	const { deployer } = await getNamedAccounts()
	console.log(`Deployer address: ${deployer}`)

	const lzEndpointAddress = LZ_ADDRESS[hre.network.name]
	console.log(`[${hre.network.name}] Endpoint Address: ${lzEndpointAddress}`)

	await deploy("OmnichainGovernanceExecutor", {
		from: deployer,
		args: [lzEndpointAddress],
		log: true,
		waitConfirmations: 1
	})
}

module.exports.tags = ["OmnichainGovernanceExecutor"]