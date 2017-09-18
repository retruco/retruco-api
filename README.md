# Retruco-API

HTTP API to bring out shared positions from argumented statements

Retruco is a software fostering argumentative discussion around statements and allowing to bring out shared positions.

**_Retruco_** means _immediate, precise and firm response_ in spanish.

## More informations

Retruco-API is currently used by 2 different projects:

* https://ogptoolbox.org/
* https://retruco.org/

Currently, the best way to study Retruco API is to look at the following user interface modules that contain every call to Retruco API:

* https://framagit.org/ogptoolbox/ogptoolbox-ui/blob/master/src/Requests.elm
* https://framagit.org/retruco/retruco-ui/blob/master/src/Requests.elm

A Swagger documentations is also available (but may currently contain errors):

* https://swagger.ogptoolbox.org/

## Installation

For the first time only:

```bash
npm install
```

### Create the database

```bash
su - postgres
createuser -D -P -R -S retruco
  Enter password for new role: retruco
  Enter it again: retruco
createdb -E utf-8 -O retruco retruco
psql retruco
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  \q
```

### Configure the API server

```bash
npm run configure
```

### Launch the API server

```bash
npm run start
```

### Launch the daemon that handles pending actions

In another terminal:

```bash
node process-actions.js
```
