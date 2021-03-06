/*
 *  data/nb-cmo/pull.js
 *
 *  David Janes
 *  Consensas
 *  2020-03-17
 *  ☘️
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
const fetch = require("iotdb-fetch")

const path = require("path")
const cheerio = require("cheerio")
const parse = require("date-fns/parse")

const _util = require("../../_util")

const minimist = require("minimist")
const ad = minimist(process.argv.slice(2), {
    boolean: [
    ],
    string: [
    ],
    alias: {
    },
})

const COUNTRY = "ca"
const PROVINCE = "nb"

/**
 */
const _pull = _.promise((self, done) => {
    _.promise(self)
        .validate(_pull)
        .make(sd => {
            sd.json = {
                date: null,
            }

            const $ = cheerio.load(self.document)

            const _contains = (a, b) => (a || "").toLowerCase().indexOf(b.toLowerCase()) > -1
            
            $("a[href='#']").each((x, e) => {
                const text = $(e).text().toLowerCase()
                const match = text.match(/^last updated: ([a-z]+ \d+, \d+)/)
                if (!match) {
                    return null
                }

                const date = parse(match[1], "MMMM dd, yyyy", new Date())
                if (!_.is.Date(date)) {
                    return null
                }

                sd.json.date = date.toISOString().substring(0, 10)
            })

            let next 
            $("p").each((x, e) => {
                const text = _util.normalize.text($(e).text())
                if (ad.verbose) {
                    console.log("-", "p.text", text) //, JSON.stringify(text))
                }
                let match

                if (next) {
                    sd.json[next] = _util.normalize.integer(text)
                    next = null
                } else if (text.startsWith("confirmed case")) {
                    next = "tests_confirmed"
                } else if (text.startsWith("probable case")) {
                    next = "tests_probable"
                } else if (text.startsWith("presumptive case")) {
                    next = "tests_probable"
                } else if (text.startsWith("negative")) {
                    next = "tests_negative"
                } else if (text.indexOf("case") > -1) {
                    next = null
                } else if (match = text.match(/^tests conducted ([\d,]+)/)) {
                    sd.json.tests = _util.normalize.integer(match[1])
                } else {
                    next = null
                }
            })

            if (ad.verbose) {
                console.log("-", "json", sd.json)
            }

            sd.path = path.join(__dirname, "raw", `${sd.json.date}.yaml`)

            if (_.size(sd.json) < 2) {
                console.log("#", "ca/ca-nb.cmo/cmo", "no/missing data for:", COUNTRY, PROVINCE)
                _.promise.bail(sd)
            }

        })
        .then(fs.make.directory.parent)
        .then(fs.write.yaml)
        .log("wrote", "path")

        .end(done, self, _pull)
})

_pull.method = "_pull"
_pull.description = ``
_pull.requires = {
}
_pull.accepts = {
}
_pull.produces = {
}

if (ad._.length) {
    _.promise({
        paths: ad._,
    })
        .each({
            method: fs.read.utf8,
            inputs: "paths:path",
            outputs: "documents",
            output_selector: sd => sd.document,
            error: error => {
                console.log("#", _.error.message(error))
            },
        })
        .each({
            method: _pull,
            inputs: "documents:document",
        })
        .except(_.error.log)
} else {
    _.promise()
        .then(fetch.document.get("https://www2.gnb.ca/content/gnb/en/departments/ocmoh/cdc/content/respiratory_diseases/coronavirus.html"))
        .then(_pull)
        .except(_.error.log)
}
