### check_fhem_max

```
## sebbo2002/check_fhem_max
Usage: check_fhem_max [Options]
Options:
  -h, --host=<STRING>         FHEM-URL (`https://fhem.sebbo.net`)
  -d, --device=<STRING>       FHEM-DEVICE (`ml`)
      --disable-http-warning  Disable warning for FHEM instances without SSL
      --help                  display this help
```

#### Example

```
check_fhem_max -h "https://fhem.sebbo.net" -d ml
```