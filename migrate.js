// Mastodon migration script
// https://docs.joinmastodon.org/api

// NOTICE: You will need to customize this script to fit the instance it will be migrating to
// Search this file for "REQUIRED:" to find the lines that need to be changed from their defaults and information on how to change them

// Settings, instance
const timeout = 60;
const instance = "mastodon.social"; // REQUIRED: You must specify the name of the instance you are migrating to
const token = ""; // REQUIRED: Set this to the access token of the application configured in your account

// Settings, timer
const interval_seconds = 1; // seconds (lag added)
const interval_probability = 0.25; // execution probability per attempt
const interval_bias = 0.5; // 0 = always reblog, 1 = always favourite

// Settings, files
const filename_path = "./mastodon.social/"; // REQUIRED: Set this to the subdirectory of the instance containing the archive
const filename_favourites = filename_path + "likes.json";
const filename_favourites_history = filename_path + "history_likes.json";
const filename_reblogs = filename_path + "outbox.json";
const filename_reblogs_history = filename_path + "history_outbox.json";
const mixed_check = true; // if true, reblog calls are checked in favourite scans, and vice versa

// Require dependency modules
const fs = require("fs");
const mastodon = require("mastodon");

var statuses_reblogs = statuses_favourites = []; // contains status objects
var history_reblogs = history_favourites = []; // contains status URL's

// Mastodon server
var server = new mastodon({
	access_token: token,
	timeout_ms: timeout * 1000,
	api_url: "https://" + instance + "/api/v1/",
});

// Message logging
function message(text) {
	const date = new Date();
	console.log(date.toUTCString() + ": " + text);
}

// Data posting
function data_post(url, do_reblog, do_favourite) {
	try {
		server.get("search", {q: url}).then(function(response) {
			// Get the local ID of the remote post
			const id = response["data"] && response["data"]["statuses"] && response["data"]["statuses"][0] && response["data"]["statuses"][0]["id"];
			if(typeof id != "string")
				return;

			if(do_reblog) {
				try {
					server.post("statuses/" + id + "/reblog").then(function(response) {
						message("Reblogged status: " + id);
					});
				} catch(error) {
					message("Error: Cound not reblog status " + id + " on the local instance, skipping this status.");
				}
			}
			if(do_favourite) {
				try {
					server.post("statuses/" + id + "/favourite").then(function(response) {
						message("Favourited status: " + id);
					});
				} catch(error) {
					message("Error: Cound not favourite status " + id + " on the local instance, skipping this status.");
				}
			}
		});
	} catch(error) {
		message("Error: Cound not fetch status url " + url + " from its remote instance, skipping this status.");
	}
}

// Data fetching
function data_fetch(scan_reblog) {
	// If scan_reblog is true, reblogs are the primary category and favourites are secondary, otherwise the other way around
	// Entries in the primary category are scanned for statuses, while their actions are guaranteed to be preformed
	// Entries in the secondary category are scanned alternatively, to also preform their actions if they exist on that category's list
	const primary_statuses = scan_reblog ? statuses_reblogs : statuses_favourites;
	const primary_history = scan_reblog ? history_reblogs : history_favourites;
	const secondary_statuses = scan_reblog ? statuses_favourites : statuses_reblogs;
	const secondary_history = scan_reblog ? history_favourites : history_reblogs;
	var do_secondary = false;

	// Scan the primary category
	for(var primary_item in primary_statuses) {
		var primary_url = primary_statuses[primary_item];
		if(typeof primary_url == "object")
			primary_url = primary_url["object"]; // URL is stored in the object entry (reblogs)
		if(typeof primary_url != "string")
			continue; // Not a valid item
		if(primary_url.substring(0, 4) != "http")
			continue; // Not a valid status URL
		if(primary_history.indexOf(primary_url) >= 0)
			continue; // Exists in the history

		if(mixed_check) {
			// Scan the secondary category
			for(var secondary_item in secondary_statuses) {
				var secondary_url = secondary_statuses[secondary_item];
				if(typeof secondary_url == "object")
					secondary_url = secondary_url["object"]; // URL is stored in the object entry (reblogs)
				if(typeof secondary_url != "string")
					continue; // Not a valid item
				if(secondary_history.indexOf(secondary_url) >= 0)
					continue; // Exists in the history

				if(secondary_url == primary_url) {
					do_secondary = true;
					break;
				}
			}
		}

		const do_reblog = scan_reblog ? true : do_secondary;
		const do_favourite = !scan_reblog ? true : do_secondary;
		if(do_reblog)
			add_history(primary_url, true);
		if(do_favourite)
			add_history(primary_url, false);

		data_post(primary_url, do_reblog, do_favourite);
		break;
	}
}

// Add to history
function add_history(item, for_reblog) {
	if(for_reblog)
		history_reblogs.push(item);
	else
		history_favourites.push(item);

	const history_file = for_reblog ? filename_reblogs_history : filename_favourites_history;
	const history_items = for_reblog ? history_reblogs : history_favourites;

	// Write items to the history file
	fs.writeFile(history_file, JSON.stringify(history_items), "utf8", function(error) {
		if(error != null)
			message("Error: History table could not be written to its file. Make sure the file " + history_file + " exists.");
	});
}

// Initialization, history data
function initialize_data_history() {
	// Reblogs: Read the items from the history file
	fs.readFile(filename_reblogs_history, function(error_reblogs, data_reblogs) {
		if(error_reblogs != null) {
			message("Error: Reblogs table could not be read from its file. Make sure the file " + filename_reblogs_history + " exists.");
		} else {
			try {
				// Reblogs: Update the history object
				history_reblogs = JSON.parse(data_reblogs);
				if(typeof history_reblogs != "object")
					return;

				// Favourites: Read the items from the history file
				fs.readFile(filename_favourites_history, function(error_favourites, data_favourites) {
					if(error_favourites != null) {
						message("Error: Favourites table could not be read from its file. Make sure the file " + filename_favourites_history + " exists.");
					} else {
						try {
							// Favourites: Update the history object
							history_favourites = JSON.parse(data_favourites);
							if(typeof history_favourites != "object")
								return;

							// Start the timer
							{
								message("Migration script initialized for instance " + instance + ".");
								interval_set();
							}
						} catch(error) {
							message("Error: Favourites table could not be parsed to JSON. Make sure the file " + filename_favourites_history + " contains an array (\"[]\").");
						}
					}
				});
			} catch(error) {
				message("Error: Reblogs table could not be parsed to JSON. Make sure the file " + filename_reblogs_history + " contains an array (\"[]\").");
			}
		}
	});
}

// Initialization, data
function initialize_data() {
	// Reblogs: Read the items from the data file
	fs.readFile(filename_reblogs, function(error_reblogs, data_reblogs) {
		if(error_reblogs != null) {
			message("Error: Reblogs table could not be read from its file. Make sure the file " + filename_reblogs + " exists.");
		} else {
			try {
				// Reblogs: Update the statuses object
				const json_reblogs = JSON.parse(data_reblogs);
				if(typeof json_reblogs["orderedItems"] == "object")
					statuses_reblogs = json_reblogs["orderedItems"];
				else
					return;

				// Favourites: Read the items from the data file
				fs.readFile(filename_favourites, function(error_favourites, data_favourites) {
					if(error_favourites != null) {
						message("Error: Favourites table could not be read from its file. Make sure the file " + filename_favourites + " exists.");
					} else {
						try {
							// Favourites: Update the statuses object
							const json_favourites = JSON.parse(data_favourites);
							if(typeof json_favourites["orderedItems"] == "object")
								statuses_favourites = json_favourites["orderedItems"];
							else
								return;

							// Initialize the history
							{
								initialize_data_history();
							}
						} catch(error) {
							message("Error: Favourites table could not be parsed to JSON. Make sure the file " + filename_favourites + " is a valid Mastodon favourites file.");
						}
					}
				});
			} catch(error) {
				message("Error: Reblogs table could not be parsed to JSON. Make sure the file " + filename_reblogs + " is a valid Mastodon reblogs file.");
			}
		}
	});
}

// Interval object
var timer = null;

// Interval function
function interval_func() {
	if(Math.random() > interval_probability)
		return;

	if(Math.random() < interval_bias)
		data_fetch(false);
	else
		data_fetch(true);
}

// Interval clear
function interval_clear() {
	clearInterval(timer);
	timer = null;
}

// Interval set
function interval_set() {
	clearInterval(timer);
	timer = setInterval(interval_func, interval_seconds * 1000);
}

// Initialize
initialize_data();
