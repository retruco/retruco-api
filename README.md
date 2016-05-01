# Retruco-API

HTTP API to bring out shared positions from argumented statements

Retruco is a software fostering argumentative discussion around statements and allowing to bring out shared positions.

**_Retruco_** means _immediate, precise and firm response_ in spanish.

## More informations

* [**Pad**](https://annuel.framapad.org/p/retruco)
* [**Kanban**](https://tableau.nuitdebout.fr/b/vLX2cHoDcXpf5AYze/retruco)

## Installation

For the first time only:

```bash
npm install
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
npm run process-votes
```

## API

To read Retruco-API API, open http://petstore.swagger.io/ and explore http://localhost:3000/swagger.json.
