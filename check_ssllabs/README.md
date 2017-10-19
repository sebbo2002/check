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