module.exports = {

    development: {

        client: "sqlite3",

        connection: {
            filename: "./database/spamf.sqlite3"
        },

        useNullAsDefault: true,

        migrations: {
            directory: "./migrations"
        },

        seeds: {
            directory: "./seeds"
        }

    }

};