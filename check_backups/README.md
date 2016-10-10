### check_backups

```
Usage: check_backups <dir> <warn> <crit> [<maxdepth>]

Options:
<dir> is the directory to look in for backups
<warn> is the maximum age of the newest backup before the state is warning
<crit> is the maximum age of the newest backup before the state is critical
<maxdepth> is the maximum search depth and optional (but very recommended for
           file backups
```

#### Example

```
check_backups /var/docker/mariadb-backups 2 4 2
```