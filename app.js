/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var watson = require('watson-developer-cloud'); // watson sdk

var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

// Create the service wrapper

var assistant = new watson.AssistantV1({
	// If unspecified here, the ASSISTANT_USERNAME and ASSISTANT_PASSWORD env properties will be checked
	// After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
	username: process.env.ASSISTANT_USERNAME || '<username>',
	password: process.env.ASSISTANT_PASSWORD || '<password>',
	version: '2018-02-16'
});

// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
	var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
	if (!workspace || workspace === '<workspace-id>') {
		return res.json({
			'output': {
				'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/assistant-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/assistant-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
			}
		});
	}
	var payload = {
		workspace_id: workspace,
		context: req.body.context || {},
		input: req.body.input || {}
	};

	// Send the input to the assistant service
	assistant.message(payload, function(err, data) {
		if (err) {
			return res.status(err.code || 500).json(err);
		}
		return res.json(updateMessage(payload, data));
	});
});

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Assistant service
 * @param  {Object} response The response from the Assistant service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response) {
	var responseText = null;
	if (!response.output) {
		response.output = {};
	} else {
		return response;
	}
	if (response.intents && response.intents[0]) {
		var intent = response.intents[0];
		// Depending on the confidence of the response the app can return different messages.
		// The confidence will vary depending on how well the system is trained. The service will always try to assign
		// a class/intent to the input. If the confidence is low, then it suggests the service is unsure of the
		// user's intent . In these cases it is usually best to return a disambiguation message
		// ('I did not understand your intent, please rephrase your question', etc..)
		if (intent.confidence >= 0.75) {
			responseText = 'I understood your intent was ' + intent.intent;
		} else if (intent.confidence >= 0.5) {
			responseText = 'I think your intent was ' + intent.intent;
		} else {
			responseText = 'I did not understand your intent';
		}
	}
	response.output.text = responseText;
	return response;
}

/**
 * Get the operands, perform the calculation and update the response text based on the
 * calculation.
 * @param {Object} response The response from the Conversation service
 * @return {Object} The response with the updated message
 */
function getCalculationResult(response) {
	//An array holding the operands
	var numbersArr = [];
	//Fill the content of the array with the entities of type 'sys-number'
	for (var i = 0; i < response.entities.length; i++) {
		if (response.entities[i].entity === 'sys-number') {
			numbersArr.push(response.entities[i].value);
		}
	}
	// In case the user intent is add, perform the addition
	// In case the intent is multiply, perform the multiplication
	var result = 0;
	if (response.intents[0].intent === 'add') {
		result = parseInt(numbersArr[0]) + parseInt(numbersArr[1]);
	} else if (response.intents[0].intent === 'multiply') {
		result = parseInt(numbersArr[0]) * parseInt(numbersArr[1]);
	}
	// Replace _result_ in Conversation Service response, with the actual calculated result
	var output = response.output.text[0];
	output = output.replace('_result_', result);
	response.output.text[0] = output;
	// Return the updated response text based on the calculation
	return response;
}

module.exports = app;