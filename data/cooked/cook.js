/*
 *  data/cooked/cook.js
 *
 *  David Janes
 *  IOTDB
 *  2020-03-15
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

/**
 */
const _find = (_items, _name) => (_items || []).find(item => item.name.toLowerCase() === _name.toLowerCase()) || null
const _year = v => v.length === 4 ? v : `20${v}`
const _month = v => v.length === 2 ? v : `0${v}`
const _day = v => v.length === 2 ? v : `0${v}`

/**
 */
const _cook = _.promise((self, done) => {
    _.promise.validate(self, _cook)

    _.promise(self)
        .then(fs.read.yaml.p(path.join(__dirname, "..", "raw", `${self.name}.yaml`)))

        // add country
        .make(sd => {
            sd.json.forEach(row => {
                row._country = ""

                let country = _find(sd.datasets.countries, row.country_region)
                if (!country) {
                    console.log("Unknown", row.country_region)
                    return
                }

                row._country = country.value
            })
        })

        // add state
        .make(sd => {
            sd.json.forEach(row => {
                row._state = ""

                if (!row.province_state) {
                    return
                }

                const state_data = sd.datasets[row._country.toLowerCase()]
                if (!state_data) {
                    return
                }

                const province_state = row.province_state.replace(/^.*, /, "")

                const state = _find(state_data, province_state)
                if (state) {
                    row._state = state.value
                    return
                }

                if ((row._country === "US") && (province_state.length === 2)) {
                    row._state = province_state
                    return
                }

                switch (row.province_state) {
                case "From Diamond Princess": row._state = "XXDP"; return
                case "Quebec": row._state = "QC"; return
                case "Diamond Princess": row._state = "XXDP"; return
                case "Grand Princess": row._state = "XXGP"; return
                case "Washington, D.C.": row._state = "DC"; return
                case "Virgin Islands, U.S.": row._state = "VI"; return
                }

                if (!row._state) {
                    console.log("Unknown", row.province_state)
                    return
                }
            })
        })

        // build rows
        .make(sd => {
            sd.json.forEach(row => {
                const key = row._state ? `${row._country.toLowerCase()}-${row._state.toLowerCase()}` : row._country.toLowerCase()
                const result = sd.results[key] = sd.results[key] || {
                    country: row._country,
                    state: row._state || null,
                    key: key,
                    items: {},
                }

                _.keys(row)
                    .map(row => row.match(/^(\d+)_(\d+)_(\d+)$/))
                    .filter(match => match)
                    .forEach(match => {
                        const o = match[0]
                        const m = match[1]
                        const d = match[2]
                        const y = match[3]
                        const key = `${_year(y)}-${_month(m)}-${_day(d)}`

                        result.items[key] = result.items[key] || {}
                        result.items[key][sd.name] = row[o]
                    })
                
                // console.log(result)
                // process.exit()
            })
        })

        .end(done, self, _cook)
})

_cook.method = "_cook"
_cook.description = ``
_cook.requires = {
    name: _.is.String,
    datasets: {
        countries: _.is.Array,
        ca: _.is.Array,
        au: _.is.Array,
        us: _.is.Array,
    },
    results: {
    }
}
_cook.produces = {
}

/**
 */
const _load_data = dataset => _.promise((self, done) => {
    _.promise(self)
        .validate(_load_data)

        .then(fs.read.yaml.p(path.join(__dirname, "..", "datasets", `${dataset}.yaml`)))
        .make(sd => {
            sd.datasets[dataset] = sd.json
        })

        .end(done, self, _load_data)
})

_load_data.method = "_load_data"
_load_data.description = ``
_load_data.requires = {
    datasets: _.is.Dictionary,
}
_load_data.produces = {
    datasets: _.is.Dictionary,
}

/**
 */
const _write = _.promise((self, done) => {
    _.promise(self)
        .validate(_write)
        .then(fs.write.yaml.p(`${self.json.key}.yaml`, null))
        .end(done, self, _write)
})

_write.method = "_write"
_write.description = ``
_write.requires = {
    json: {
        country: _.is.String,
        key: _.is.String,
        items: _.is.Dictionary,
    }
}
_write.accepts = {
    json: {
        state: _.is.String,
    }
}
_write.produces = {
}

/**
 */
_.promise({
    datasets: {},
    results: {},
})
    .then(_load_data("ca"))
    .then(_load_data("us"))
    .then(_load_data("au"))
    .then(_load_data("countries"))

    .add("names", [ "deaths", "confirmed", "recovered", ])
    .each({
        method: _cook,
        inputs: "names:name",
    })

    .make(sd => {
        sd.result_list = _.values(sd.results)
    })
    .each({
        method: _write,
        inputs: "result_list:json",
    })

    .except(_.error.log)