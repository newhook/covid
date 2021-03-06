/*
 *  data/on-cmo/cook.js
 *
 *  David Janes
 *  Consensas
 *  2020-03-16
 *
 *  Copyright (2013-2020) David P. Janes
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

"use strict"

console.log("discontinued")
process.exit()

const _ = require("iotdb-helpers")
const fs = require("iotdb-fs")

const path = require("path")
const _util = require("../../_util")

_.promise({
    settings: {
        authority: "consensas",
        dataset: "cmo",
        region: "ON",
        country: "CA",
    },
})
    .then(fs.list.p(path.join(__dirname, "raw")))
    .each({
        method: fs.read.json.magic,
        inputs: "paths:path",
        outputs: "jsons",
        output_selector: sd => sd.json,
    })
    .make(sd => {
        sd.json = _util.record.main(sd.settings)
        sd.json.items = []

        sd.jsons
            .filter(json => json.date && json.status)
            .forEach(json => {
                const item = {
                    "@id": `${sd.json["@id"]}:${json.date}`,
                    date: json.date,
                }
                
                json.status.forEach(tuple => {
                    const number = _util.normalize.integer(tuple[1])
                    const key = _util.normalize.text(tuple[0])

                    if (key.startsWith("total number") || key.startsWith("total tested")) {
                        item.tests_ordered = number
                    } else if (key.startsWith("confirmed neg") || key.startsWith("neg")) {
                        item.tests_negative = number
                    } else if (key.startsWith("presumptive neg")) {
                        // item.tests_xxx = number
                    } else if (key.startsWith("confirmed p") || key.startsWith("pos")) {
                        item.tests_positive = number
                    } else if (key.startsWith("presumptive p")) {
                        // item.tests_xxx = number
                    } else if (key.startsWith("resolved")) {
                        item.tests_resolved = number
                    } else {
                        console.log("-", "key", key)
                    }
                })

                item.tests = (item.tests_negative || 0) + (item.tests_positive || 0) + (item.tests_resolved || 0) 

                sd.json.items.push(item)
            })

        sd.json = [ sd.json ]
        sd.path = path.join(__dirname, "cooked", _util.record.filename(sd.settings))
    })

    .then(fs.make.directory.parent)
    .then(fs.write.yaml)
    .log("wrote", "path")

    .except(_.error.log)
