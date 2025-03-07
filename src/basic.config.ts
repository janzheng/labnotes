// basic.config.ts lets you define the schema for your database
// after updating this file, you may need to restart the dev server
// docs: https://docs.basic.tech/info/schema 

export const schema = {
  "tables": {
    "emojis": {
      "type": "collection",
      "fields": {
        "value": {
          "type": "string",
          "indexed": true
        }
      }
    },
    "projects": {
      "type": "collection",
      "fields": {
        "localId": {
          "type": "string",
          "indexed": true
        },
        "lastModified": {
          "type": "number",
          "indexed": true
        },
        "data": {
          "type": "json",
          "indexed": true
        }
      }
    }
  },
  "version": 9,
  "project_id": "1b9522ea-a896-45f0-b3fa-082ed2110ed4"
}