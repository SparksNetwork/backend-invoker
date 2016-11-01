FROM alpine:3.4

RUN apk add --update nodejs git python g++ make

RUN mkdir /app
WORKDIR /app

ADD package.json .
RUN npm install
ADD . .
RUN node_modules/.bin/tsc

ENV S3_BUCKET=terraform.sparks.network
ENV FUNCTIONS_KEY=functions.json
ENV SCHEMAS_KEY=schemas.json

ENTRYPOINT ["npm", "run"]
CMD ["start"]
