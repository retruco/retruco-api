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

To explore Retruco API, open http://petstore.swagger.io/ and explore http://localhost:3000/swagger.json.

## Example

### Create a user

```bash
cat <<'EOF' | curl -X POST --header "Content-Type: application/json" --header "Accept: application/json" --data-binary @- "http://localhost:3000/users"
{
  "name": "Retruco Admin",
  "urlName": "retruco-admin",
  "password": "secret"
}
EOF
```

### Login to retrieve user API key

```bash
cat <<'EOF' | curl -X POST --header "Content-Type: application/json" --header "Accept: application/json" --data-binary @- "http://localhost:3000/login"
{
  "userName": "retruco-admin",
  "password": "secret"
}
EOF
```

And retrieve the API key in field `data.apiKey` of the response.
