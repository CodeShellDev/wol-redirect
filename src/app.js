const express = require('express')

const { execFile } = require('child_process')

const path = require("path")
const fs = require("fs")

const cors = require("cors")

const auth = require("./auth")

const PATTERN = process.env.PATTERN || ""
const WOL_URL = process.env.WOL_URL || null
const WOLD_URL = process.env.WOLD_URL || null

const CONFIG_PATH = process.env.CONFIG_PATH || "config/mapping.json"

const app = express()

app.set('view engine', 'ejs')

app.use("/", auth)

app.get("/data", (req, res, next) => {
    StartProcessing(req, res, next)
})

function BuildQuery(pattern, context) {
    let query = pattern

    for (const [key, value] of Object.entries(context)) {
        query = query.replaceAll(`{${key}}`, value)
    }

    return query
}

async function Post(url, data) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })

        if (!response.ok) {
            throw new Error(`Could not fetch [POST] from ${url}.`)
        }

        return await response.json()
    } catch (error) {
        console.error('Error:', error)
        return null
    }
}

function GetDataByHostname(hostname) {
    let ipTable = []

    if (!fs.existsSync(CONFIG_PATH)) {
        return ipTable
    }

    const data = fs.readFileSync(CONFIG_PATH)

    let obj = JSON.parse(data)

    let record = obj.records[hostname]

    if (!record) {
        console.log(`Could not find a Record for ${hostname}.`)

        record = obj.records["any"]

        if (!record) {
            return null
        } else {
            console.log(`Using wildcard Record instead.`)
        }
    }

    let route = obj.routes[record]

    if (!route) {
        console.log(`Could not find a Route for ${record}.`)
        return null
    }
    else {
        route = route["route"]
    
        if (!route) {
            console.log(`Could not find a Route Instructions for ${record}.`)
            return null
        }
    }

    let routeAttributes = obj.routes[record]["attributes"]

    for (let i = 0; i < route.length; i++) {
        let host = obj.hosts[route[i]]

        if (!host) {
            console.log(`Could not find a Host for ${route[i]}.`)
            
            host = obj.hosts["any"]
    
            if (!host) {
                return null
            } else {
                console.log(`Using wildcard Host instead.`)
            }
        }

        const isVirtual = host.isVirtual?? false 
        
        if (!host.isVirtual) {
            ipTable[i] = { ip: host.ip, mac: host.mac, startupTime: host.startupTime, isVirtual: false }
        } else {
            ipTable[i] = { ip: host.ip, id: host.id, startupTime: host.startupTime, isVirtual: true }
        }
    }

    return { hosts: ipTable, routeAttributes: routeAttributes }
}

async function TrySendWakeupPackets(hosts, url) {
    let err = false
    let output = ""

    if (hosts == []) {
        return null
    }

    for (const host of hosts) {
        const ip = host.ip
        const time = host.startupTime

        let data = null

        if (host.isVirtual) {
            data = {
                id: host.id,
                startupTime: time
            }

            url = `http://${ip}:9000`
        } else {
            data = {
                ip: ip,
                mac: host.mac,
                startupTime: time
            }
        }

        console.log(`Sending Wakeup Packets to ${ip}:\n${JSON.stringify(data)}`)

        try {
            const response = await Post(url, data)

            console.log(`Got\n${JSON.stringify(response)}\nfrom ${url}`)

            let resData = response.message

            if (resData) {
                if (resData?.output != undefined && !host.isVirtual) {
                    output += resData.output

                    console.log(`Output from ${url}:\n${output}`)
                }

                if (resData?.success != null) {
                    if (resData.success) {
                        err = false
                    }
                    else {
                        err = true
                        break
                    }
                }
            } else {
                err = true
                break
            }
        } catch (error) {
            console.error(`Error during request to ${url}:`, error)
        }
    }

    return { output: output, err: err}
}

function StartProcessing(req, res, next)
{
    const originalUrl = req.cookies.serviceUrl
    const url = new URL(originalUrl)

    let output = ""
    let err = false

    let port = url.port

    if (!port) {
        port = ""
    }

    const context = {
        HOST: url.host,
        HOSTNAME: url.hostname,
        PORT: port,
        PROTOCOL: url.protocol,
        URL: originalUrl,
        PATH: url.pathname
    }

    const query = BuildQuery(PATTERN, context)

    const { hosts, routeAttributes } = GetDataByHostname(url.hostname)

    let wakeDocker = false
    
    if (routeAttributes) {
        if (routeAttributes["wakeDocker"]) {
            wakeDocker = routeAttributes["wakeDocker"]
        }
    }

    console.log(JSON.stringify(hosts))

    if (!hosts || hosts == []) {
        console.log(`Could not get MAC and IP for ${url.hostname}`)
        console.log(`Presuming to Wakeup Container`)
    }

    const woldData = {
        query: query
    }

    TrySendWakeupPackets(hosts, WOL_URL).then(wolResData => {
        if (wolResData != null) {  
            err = wolResData.err
            output = wolResData.output
        }

        if (!err && WOLD_URL && wakeDocker) {
            console.log(`Sending WakeupDock Packets to ${WOLD_URL}:\n${JSON.stringify(woldData)}`)

            Post(WOLD_URL, woldData).then(woldResData => {
                console.log(`Got\n${JSON.stringify(woldResData)}\nfrom ${WOLD_URL}`)

                if (wolResData != null) {   
                    woldResData = woldResData.message

                    if (woldResData) {
                        if (woldResData?.success != null) {
                            if (woldResData.success) {
                                output += "Service is now reachable.\n"
                            }
                        }
                    } else {
                        err = true

                        output += "Could not Startup Service.\n"
                    }
                } else {
                    err = true
                }


                return res.json( { url: originalUrl, log: output, error: err, host: url.hostname } )
            })
        }
        else {
            return res.json( { url: originalUrl, log: output, error: err, host: url.hostname } )
        }
    })
}

const PORT = process.env.PORT || 80

app.listen(PORT, () => {
    console.log(`Server is running on Port ${PORT}`)
})
