/*
 *  data/us.covidtracking/cook.js
 *
 *  David Janes
 *  Consensas
 *  2020-03-23
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

const _ = require("iotdb-helpers")
const fs = require("iotdb-fs")

const path = require("path")

const COUNTRY = "us"
const NAME = `${COUNTRY}-tests.yaml`

_.promise()
    .then(fs.list.p(path.join(__dirname, "raw")))
    .each({
        method: fs.read.json.magic,
        inputs: "paths:path",
        outputs: "jsons",
        output_selector: sd => sd.json,
    })
    .make(sd => {
        sd.json = {
            "@context": "https://consensas.world/m/covid",
            "@id": `urn:covid:covidtracking.com:${COUNTRY}:cases:cmo`,
            country: COUNTRY.toUpperCase(),
            key: `${COUNTRY}`.toLowerCase(),
            items: sd.jsons.map(_item => {
                const date = `${_item.date}`.replace(/^(....)(..)(..)$/, "$1-$2-$3")
                const item = {
                    "@id": `urn:covid:covidtracking.com:${COUNTRY}:cases:${date}`,
                    date: date,
                    tests: _.d.first(_item, "total", null),
                    tests_positive: _.d.first(_item, "positive", null),
                    tests_negative: _.d.first(_item, "negative", null),
                    tests_pending: _.d.first(_item, "pending", null),
                }

                return item
            }),
        }

        sd.json = [ sd.json ]
    })

    .add("path", path.join(__dirname, NAME))
    .then(fs.write.yaml)
    .log("wrote", "path")
    
    .except(_.error.log)
