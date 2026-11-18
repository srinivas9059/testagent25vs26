# Windows scripts

`start.ps1` builds and starts the app with Docker Compose and waits for the health check. `stop.ps1` removes the app container and preserves its named data volume. Both scripts locate the Compose file relative to this directory.
