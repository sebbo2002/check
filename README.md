# check

[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)

Just some Nagios checks…


## Installation

For usage, node.js is required. Then you can run `npm install -g @sebbo2002/check` to install these checks.


## Quick Start

### check_ssllabs

```
Usage: check_ssllabs [Options]
Options:
  -h, --host=<STRING>      Host which should be tested
  -w, --warning=<STRING>   Warning threshold
  -c, --critical=<STRING>  Critical threshold
      --help               display this help
```

#### Example

```
check_sslscan -h ci.sebbo.net -w A- -c B
```