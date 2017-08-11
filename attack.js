#!/usr/bin/env node

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const parse = require('url-parse')
const chalk = require('chalk')
const uri = process.argv[2]
const parts = parse(uri)
const server = parts.protocol == 'https:' ? require('https') : require('http')

const runs = [1, 10, 10, 100, 100, 100, 200, 200, 200, 200, 500, 1000, 10000]

/**
 * Stress test an HTTP/HTTPS endpoint, with ramp up curve
 *
 * usage: attack https://url.com/foo
 */
function attack (count, cb) {

  let good = 0
  let bad = 0
  let requests = []

  for (let n = 0; n < count; n++) {

    requests.push(
      server.get({
        hostname: parts.hostname,
        port: parts.port,
        path: parts.path,
        agent: false
      }, function (res) {
        good++

        if (good + bad == count) {
          cb(good, bad)
        }

      })
      .on('error', function(err) {
        bad++

        // if more than 20% of reqests error out, bail
        if (bad/(good+bad) > 0.2) {

          // cancel in flight requests
          requests.forEach(function (request) {
            if (request.abort) {
              request.abort()
            }
          })

          cb(good, bad)

        }

        if (good + bad == count) {
          cb(good, bad)
        }

      })
    )

  }

}

function go (runs) {

  let start = Date.now()

  attack(runs[0], function (good, bad) {

    let total = good + bad
    let rate = good/total
    let time = Date.now() - start
    let niceRate = (100*rate).toFixed(2) + '%'

    if (rate == 1) {
      niceRate = chalk.green(niceRate)
    } else if (rate > 0.9) {
      niceRate = chalk.yellow(niceRate)
    } else {
      niceRate = chalk.red(niceRate)
    }

    console.log(chalk.blue(runs[0], 'requests:', good + '/' + total, '(' + niceRate + ') - done in', time + 'ms (' + (time/total).toFixed(2), 'ms/request, ' + (total/(time/1000)).toFixed(2) + 'qps)'))

    if (rate > 0.8) {

      setTimeout(function(){
        go(runs.slice(1))
      }, 5000);

    } else {
      console.log('done!')
    }

  })

}

console.log('swarming', uri + '...')

go(runs)