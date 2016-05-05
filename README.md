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

To explore Retruco API, open [sample Swagger UI](http://petstore.swagger.io/) and explore http://localhost:3000/swagger.json.

## API usage

### API usage for users

#### Create a user

```bash
cat <<'EOF' | curl -X POST --header "Content-Type: application/json" --header "Accept: application/json" --data-binary @- "http://localhost:3000/users"
{
  "name": "Alice",
  "urlName": "alice",
  "password": "secret"
}
EOF
```

#### Login to retrieve user API key

```bash
cat <<'EOF' | curl -X POST --header "Content-Type: application/json" --header "Accept: application/json" --data-binary @- "http://localhost:3000/login"
{
  "userName": "alice",
  "password": "secret"
}
EOF
```

Returns:

```json
{
  "apiVersion": "1",
  "data": {
    "apiKey": "HoIw4IqGwymIeP+xRK2MUg",
    "createdAt": "2016-05-03T21:28:34.447Z",
    "name": "Alice",
    "urlName": "alice"
  }
}
```

Retrieve the API key in field `data.apiKey` of the response.

### API usage for statements

#### Create statements belonging to this user

```bash
cat <<'EOF' | curl -X POST --header "Content-Type: application/json" --header "Accept: application/json" --header "Retruco-API-Key: HoIw4IqGwymIeP+xRK2MUg" --data-binary @- "http://localhost:3000/statements"
{
  "type": "PlainStatement",
  "languageCode": "fr",
  "name": "Il faut ouvrir le code source des logiciels du secteur public"
}
EOF
```

```bash
cat <<'EOF' | curl -X POST --header "Content-Type: application/json" --header "Accept: application/json" --header "Retruco-API-Key: HoIw4IqGwymIeP+xRK2MUg" --data-binary @- "http://localhost:3000/statements"
{
  "type": "PlainStatement",
  "languageCode": "fr",
  "name": "Ouvrir le code source est préférable à ouvrir les algorithmes"
}
EOF
```

#### List all statements

```bash
curl --header "Accept: application/json" "http://localhost:3000/statements"
```

Returns:

```json
{
  "apiVersion": "1",
  "data": [
    {
      "createdAt": "2016-05-05T17:32:23.143Z",
      "id": "1630eafd-e387-44bf-abbb-70c5bf9fdfc8",
      "languageCode": "fr",
      "name": "Il est plus pratique de diffuser le code source que de le communiquer au cas par cas aux citoyens qui en font la demande",
      "type": "PlainStatement"
    },
    {
    {
      "createdAt": "2016-05-03T21:42:48.226Z",
      "id": "c671c17e-a272-4a6a-9bc1-2b82db7c7499",
      "languageCode": "fr",
      "name": "Ouvrir le code source est préférable à ouvrir les algorithmes",
      "type": "PlainStatement"
    },
    {
      "createdAt": "2016-05-03T21:31:18.124Z",
      "id": "82d4e0ac-c234-45eb-8ba2-02d4d6a41979",
      "languageCode": "fr",
      "name": "Il faut ouvrir le code source des logiciels du secteur public",
      "type": "PlainStatement"
    }
  ]
}
```

#### Get a specific statement

```bash
curl --header "Accept: application/json" "http://localhost:3000/statements/82d4e0ac-c234-45eb-8ba2-02d4d6a41979"
```

Returns:

```json
{
  "apiVersion": "1",
  "data": {
    "createdAt": "2016-05-03T21:31:18.124Z",
    "id": "82d4e0ac-c234-45eb-8ba2-02d4d6a41979",
    "languageCode": "fr",
    "name": "Il faut ouvrir le code source des logiciels du secteur public",
    "authorName": "alice"
  }
}
```

#### Rate a statement

```bash
cat <<'EOF' | curl -X POST --header "Content-Type: application/json" --header "Accept: application/json" --header "Retruco-API-Key: HoIw4IqGwymIeP+xRK2MUg" --data-binary @- "http://localhost:3000/statements/82d4e0ac-c234-45eb-8ba2-02d4d6a41979/rating"
{
  "rating": 1
}
EOF
```

Returns:

```json
{
  "apiVersion": "1",
  "data": {
    "rating": 1,
    "statementId": "82d4e0ac-c234-45eb-8ba2-02d4d6a41979",
    "updatedAt": "2016-05-03T21:33:34.282Z",
    "voterName": "alice"
  }
}
```

#### Get an existing statement rating

```bash
curl --header "Content-Type: application/json" --header "Accept: application/json" --header "Retruco-API-Key: HoIw4IqGwymIeP+xRK2MUg" "http://localhost:3000/statements/82d4e0ac-c234-45eb-8ba2-02d4d6a41979/rating"
```

Returns:

```json
{
  "apiVersion": "1",
  "data": {
    "rating": 1,
    "statementId": "82d4e0ac-c234-45eb-8ba2-02d4d6a41979",
    "updatedAt": "2016-05-03T21:33:34.282Z",
    "voterName": "alice"
  }
}
```

#### Delete an exiting statement rating

```bash
curl -X DELETE --header "Content-Type: application/json" --header "Accept: application/json" --header "Retruco-API-Key: HoIw4IqGwymIeP+xRK2MUg" "http://localhost:3000/statements/82d4e0ac-c234-45eb-8ba2-02d4d6a41979/rating"
```

Returns:

```json
{
  "apiVersion": "1",
  "data": {
    "rating": 1,
    "statementId": "82d4e0ac-c234-45eb-8ba2-02d4d6a41979",
    "updatedAt": "2016-05-03T21:33:34.282Z",
    "voterName": "alice"
  }
}
```

#### Get a non-existing statement rating

```bash
curl --header "Content-Type: application/json" --header "Accept: application/json" --header "Retruco-API-Key: HoIw4IqGwymIeP+xRK2MUg" "http://localhost:3000/statements/82d4e0ac-c234-45eb-8ba2-02d4d6a41979/rating"
```

Returns:

```json
{
  "apiVersion": "1",
  "data": {
    "statementId": "82d4e0ac-c234-45eb-8ba2-02d4d6a41979",
    "voterName": "alice"
  }
}
```

#### Delete a non-exiting statement rating

```bash
curl -X DELETE --header "Content-Type: application/json" --header "Accept: application/json" --header "Retruco-API-Key: HoIw4IqGwymIeP+xRK2MUg" "http://localhost:3000/statements/82d4e0ac-c234-45eb-8ba2-02d4d6a41979/rating"
```

Returns:

```json
{
  "apiVersion": "1",
  "data": {
    "statementId": "82d4e0ac-c234-45eb-8ba2-02d4d6a41979",
    "voterName": "alice"
  }
}
```

### API usage for arguments

#### Get a specific argument

```bash
curl --header "Accept: application/json" "http://localhost:3000/statements/82d4e0ac-c234-45eb-8ba2-02d4d6a41979/arguments/c671c17e-a272-4a6a-9bc1-2b82db7c7499"
```

Returns:

```json
{
  "apiVersion": "1",
  "data": {
    "claimId": "82d4e0ac-c234-45eb-8ba2-02d4d6a41979",
    "createdAt": "2016-05-05T17:41:10.863Z",
    "groundId": "c671c17e-a272-4a6a-9bc1-2b82db7c7499",
    "id": "0d872e6d-6760-442f-aefa-82a0c06f104d",
    "type": "Argument"
  }
}
```

#### Rate an argument

```bash
cat <<'EOF' | curl -X POST --header "Content-Type: application/json" --header "Accept: application/json" --header "Retruco-API-Key: HoIw4IqGwymIeP+xRK2MUg" --data-binary @- "http://localhost:3000/statements/82d4e0ac-c234-45eb-8ba2-02d4d6a41979/arguments/c671c17e-a272-4a6a-9bc1-2b82db7c7499/rating"
{
  "rating": 1
}
EOF
```

Returns:

```json
{
  "apiVersion": "1",
  "data": {
    "rating": 1,
    "statementId": "0d872e6d-6760-442f-aefa-82a0c06f104d",
    "updatedAt": "2016-05-05T17:43:05.322Z",
    "voterName": "alice"
  }
}
```

#### Get the now rated argument

```bash
curl --header "Accept: application/json" "http://localhost:3000/statements/82d4e0ac-c234-45eb-8ba2-02d4d6a41979/arguments/c671c17e-a272-4a6a-9bc1-2b82db7c7499"
```

Returns:

```json
{
  "apiVersion": "1",
  "data": {
    "claimId": "82d4e0ac-c234-45eb-8ba2-02d4d6a41979",
    "createdAt": "2016-05-05T17:41:10.863Z",
    "groundId": "c671c17e-a272-4a6a-9bc1-2b82db7c7499",
    "id": "0d872e6d-6760-442f-aefa-82a0c06f104d",
    "rating": 1,
    "ratingCount": 1,
    "ratingSum": 1,
    "type": "Argument"
  }
}
```

### API usage for abuses

#### Get a specific abuse

```bash
curl --header "Accept: application/json" "http://localhost:3000/statements/1630eafd-e387-44bf-abbb-70c5bf9fdfc8/abuse"
```

Returns:

```json
{
  "apiVersion": "1",
  "data": {
    "createdAt": "2016-05-05T18:51:58.488Z",
    "id": "d342c445-d12e-40b2-81d9-c2b7939fc732",
    "statementId": "1630eafd-e387-44bf-abbb-70c5bf9fdfc8",
    "type": "Abuse"
  }
}
```

#### Rate an argument and its ground statement

```bash
cat <<'EOF' | curl -X POST --header "Content-Type: application/json" --header "Accept: application/json" --header "Retruco-API-Key: HoIw4IqGwymIeP+xRK2MUg" --data-binary @- "http://localhost:3000/statements/82d4e0ac-c234-45eb-8ba2-02d4d6a41979/arguments/1630eafd-e387-44bf-abbb-70c5bf9fdfc8/rating"
{
  "rating": 1
}
EOF
```

```bash
cat <<'EOF' | curl -X POST --header "Content-Type: application/json" --header "Accept: application/json" --header "Retruco-API-Key: HoIw4IqGwymIeP+xRK2MUg" --data-binary @- "http://localhost:3000/statements/1630eafd-e387-44bf-abbb-70c5bf9fdfc8/rating"
{
  "rating": 1
}
EOF
```

#### Rate an abuse

```bash
cat <<'EOF' | curl -X POST --header "Content-Type: application/json" --header "Accept: application/json" --header "Retruco-API-Key: HoIw4IqGwymIeP+xRK2MUg" --data-binary @- "http://localhost:3000/statements/1630eafd-e387-44bf-abbb-70c5bf9fdfc8/abuse/rating"
{
  "rating": 1
}
EOF
```

Returns:

```json
{
  "apiVersion": "1",
  "data": {
    "rating": 1,
    "statementId": "d342c445-d12e-40b2-81d9-c2b7939fc732",
    "updatedAt": "2016-05-05T18:55:49.961Z",
    "voterName": "alice"
  }
}
```

#### Delete an abuse rating

```bash
curl -X DELETE --header "Content-Type: application/json" --header "Accept: application/json" --header "Retruco-API-Key: HoIw4IqGwymIeP+xRK2MUg" "http://localhost:3000/statements/1630eafd-e387-44bf-abbb-70c5bf9fdfc8/abuse/rating"
```
