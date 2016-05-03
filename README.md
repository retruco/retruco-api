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

Returns:
```json
{
  "apiVersion": "1",
  "data": {
    "apiKey": "ROQuhYRs1drbvthwM8dI/A",
    "createdAt": "2016-05-01T16:30:01.695Z",
    "name": "Retruco Admin",
    "urlName": "retruco-admin"
  }
}
```

Retrieve the API key in field `data.apiKey` of the response.

### Create a statement belonging to this user.

```bash
cat <<'EOF' | curl -X POST --header "Content-Type: application/json" --header "Accept: application/json" --header "Retruco-API-Key: ROQuhYRs1drbvthwM8dI/A" --data-binary @- "http://localhost:3000/statements"
{
  "languageCode": "fr",
  "name": "Il faut ouvrir le code source des logiciels du secteur public."
}
EOF
```

### List all statements.

```bash
curl --header "Accept: application/json" "http://localhost:3000/statements"
```

Returns:
```json
{
  "apiVersion": "1",
  "data": [
    {
      "createdAt": "2016-05-02T13:37:17.070Z",
      "id": "7ebd3fab-3ad5-49c2-9eca-c6e272109ffe",
      "languageCode": "fr",
      "name": "Il faut ouvrir le code source des logiciels du secteur public."
    }
  ]
}
```

### List a specific statement

```bash
curl --header "Accept: application/json" "http://localhost:3000/statements/7ebd3fab-3ad5-49c2-9eca-c6e272109ffe"
```

Returns:
```json
{
  "apiVersion": "1",
  "data": {
    "createdAt": "2016-05-02T13:37:17.070Z",
    "id": "7ebd3fab-3ad5-49c2-9eca-c6e272109ffe",
    "languageCode": "fr",
    "name": "Il faut ouvrir le code source des logiciels du secteur public.",
    "authorName": "retruco-admin"
  }
}
```

### Rate a statement

```bash
cat <<'EOF' | curl -X POST --header "Content-Type: application/json" --header "Accept: application/json" --header "Retruco-API-Key: ROQuhYRs1drbvthwM8dI/A" --data-binary @- "http://localhost:3000/statements/7ebd3fab-3ad5-49c2-9eca-c6e272109ffe/rating"
{
  "rating": 1
}
EOF
```
