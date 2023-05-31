# KTHB Dialog
KTH Bibliotekets formulärtjänst

## Funktioner
Startas i en Dockercontainer

###
Deploy via github actions som anropar en webhook

#### Dependencies

Node 16.13.2

##### Installation

1.  Skapa folder på server med namnet på repot: "/local/docker/formtools"
2.  Skapa och anpassa docker-compose.yml i foldern
```
version: '3.6'

services:
  formtools:
    container_name: formtools
    image: ghcr.io/kth-biblioteket/formtools:${REPO_TYPE}
    restart: always
    depends_on:
      - formtools-db
    env_file:
      - formtools.env
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.formtools.rule=Host(`${DOMAIN_NAME}`) && PathPrefix(`${PATHPREFIX}`)"
      - "traefik.http.routers.formtools.entrypoints=websecure"
      - "traefik.http.routers.formtools.tls=true"
      - "traefik.http.routers.formtools.tls.certresolver=myresolver"
    volumes:
      - "/local/docker/formtools/imagebank:/app/imagebank"
    networks:
      - "apps-net"

  formtools-db:
    container_name: formtools-db
    image: mysql:8.0
    volumes:
      - persistent-formtools-db:/var/lib/mysql
      - ./dbinit:/docker-entrypoint-initdb.d
    restart: unless-stopped
    command: --default-authentication-plugin=mysql_native_password
    environment:
      MYSQL_DATABASE: ${DB_DATABASE}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
    networks:
      - "apps-net"

volumes:
  persistent-formtools-db:

networks:
  apps-net:
    external: true

```
3.  Skapa och anpassa .env(för composefilen) i foldern
```
PATHPREFIX=/formtools
DOMAIN_NAME=apps-ref.lib.kth.se
REPO_TYPE=ref
API_ROUTES_PATH=/api/v1
DB_DATABASE=formtools
DB_USER=formtools
DB_PASSWORD=XXXXXX
DB_ROOT_PASSWORD=XXXXXX
```
4.  Skapa och anpassa formtools.env (för applikationen) i foldern
```


PORT=80
APP_PATH=/formtools
API_PATH=/api/v1
APIKEY=XXXXXX
ALMA_API_URL = https://api-eu.hosted.exlibrisgroup.com/almaws/v1/
ALMA_API_KEY = XXXXXX
ALMA_API_KEY_PROD = XXXXXX
ALMA_API_KEY_SANDBOX = XXXXXX
FORMSCONFIG_URL = /formtools/assets/
LDAPAPIPATH=ldap-api/api/v1/
SMTP_HOST=relayhost.sys.kth.se
SMTP_HOST_NEW=relayhost.sys.kth.se
MAILFROM_NAME_SV=KTH Bibliotekets löftesinsamling
MAILFROM_NAME_EN=KTH Library promise
MAILFROM_ADDRESS=noreply@apps-ref.lib.kth.se
MAILFROM_SUBJECT_SV=Ditt lämnade löfte.
MAILFROM_SUBJECT_EN=Your promise.
EDGE_MAIL_ADDRESS=tholind@kth.se
SECRET=XXXXXX
LDAPAPIKEYREAD=XXXXXX
DATABASEHOST=formtools-db
DATABASE=formtools
DATABASEUSER=formtools
DATABASEPWD=XXXXXX
DATABASEROOTPWD=XXXXXX
GITHUBTOKEN=XXXXXX
LOG_LEVEL=debug
NODE_ENV=development
IMAGE_FORMAT=jpg
AUTHORIZEDGROUPS=pa.anstallda.T.TR;pa.anstallda.M.MOE
LABELTYPE=fa-heart
```
5.  Skapa folder "local/docker/formtools/imagesbank"
6.  Skapa folder "local/docker/formtools/dbinit"
7. Skapa init.sql från repots dbinit/init.sql
8. Skapa deploy_ref.yml i github actions
9. Skapa deploy_prod.yml i github actions
10. Github Actions bygger en dockerimage i github packages
11. Starta applikationen med docker compose up -d --build i "local/docker/formtools"

