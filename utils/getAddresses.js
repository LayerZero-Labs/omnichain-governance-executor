const environments = require("../constants/environments.json")
const fs = require("fs")

const environmentArg = process.argv[2]
const contractCsvArg = process.argv[3]

async function getAddresses(environment, contractCsv) {
    let contracts = contractCsv.split(",")
    const promises = []
    for (const contract of contracts) {
        promises.push("\n" + contract)
        const networks = environments[environment];
        for (const network of networks) {
            let fileName = `deployments/${network}/${contract[0].toUpperCase() + contract.substring(1)}.json`;
            if(fs.existsSync(fileName)) {
                promises.push(getAddressForNetwork(fileName, network))
            }
        }
    }
    const resolvedPromises = await Promise.all(promises)
    resolvedPromises.forEach((networkAddressStr) => {
        console.log(networkAddressStr)
    })
}

function getAddressForNetwork(file, network) {
    return new Promise((res) => {
        fs.readFile(file, (error, content) => {
            if (content === undefined) {
                console.log(`File: ${file} does not exsist`)
                return
            }
            res(`${network}: ${JSON.parse(content).address}`)
        })
    })
}

// to run: node getAddresses ${ENVIRONMENT} ${CONTRACT_CSV}
// example: node getAddresses testnet Relayer,Endpoint,UltraLightNode
getAddresses(environmentArg, contractCsvArg).then((res) => console.log("\nComplete!"))
