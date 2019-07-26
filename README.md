# Mastodon Migration script

A script for the Mastodon social network written in Node.js which allows migrating content from an ActivityPub archive to another account. To avoid excessive spam and content duplication, this script only migrates favourites and reblogs, posts and media will not be ported! It's recommended that you adjust the timer settings to ensure the script operates above the flood limitations of the instance you're migrating to.

https://docs.joinmastodon.org/api

## Instructions

- Go to the settings panel of the Mastodon account you wish to migrate from. Select "Import and export" then choose "Request your archive". Wait for the archive to compile then download the tar.gz file. Note that Mastodon will only let you request a new archive every 7 days!
- Unpack the archive as a subdirectory in the same directory as this script. Rename it to match the name of the target instance, for example "mastodon.social". Note that you must edit the path setting in the script and point it to the name of this subdirectory. Note that the subdirectory only needs to contain two files by default: "likes.json" and "outbox.json".
- Inside this subdirectory you must create two new files by default: "history_likes.json" and "history_outbox.json". Give them the content "[]" to create an empty array. This is a limitation that may be lifted in the future.
- Go to the settings panel of the Mastodon account you're migrating to. Select "Development" and click "New application". Create a new app and give it full Read and Write permissions. Navigate to it and copy its Access Token, then paste the character string into the script's token setting. Now set the name of the target site to this instance.
- Open a bash prompt and type "node ./migrate.js". This should start the migration process which will copy likes and boosts from the archive to your new account.
