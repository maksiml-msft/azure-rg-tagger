const { AzureCliCredential, ManagedIdentityCredential } = require("@azure/identity");
const { ResourceGroup, ResourceManagementClient, TagsPatchResource } = require("@azure/arm-resources");

module.exports = async function (context, req) {
    context.log.verbose("started");
    var eventPayload = require('zealit')(req.body.data); //helps nested lookups by turning undefined gets to exceptions
    context.log.verbose(eventPayload);

    //Apply filter that is not configurable from the alert creation
    context.log.verbose("checking additional filter");
    if (!shouldRespondToEvent(eventPayload)) {
        context.log.verbose("event was filtered out");
        end(200, "skipped", "verbose");
        return;
    }

    context.log.verbose("extracting mandatory data from event");
    try {
        var rgName = eventPayload.context.activityLog.resourceGroupName;
        var userName = eventPayload.context.activityLog.caller;
        var subscriptionId = eventPayload.context.activityLog.subscriptionId;
    }
    catch (err) {
        context.log.verbose("failed to extract mandatory data from event");
        end(400, "error extracting data from body", "error");
        return;
    }

    var credential = createCredentials();
    const resourceClient = new ResourceManagementClient(credential, subscriptionId);
    const resourceGroup = await resourceClient.resourceGroups.get(rgName).catch(error => {
        context.log.verbose("error getting resource group metadata: " + error.message);
        end(500, "error getting resource group metadata: " + error.message, "error");
    });

    const tags = await resourceClient.tagsOperations.getAtScope(resourceGroup.id);
    const devOwner = tags.properties.tags["DevOwner"];
    if(typeof devOwner === undefined) {
        devOwner = userName
    };

    await resourceClient.tagsOperations.updateAtScope(resourceGroup.id, 
        { 
            operation: "merge",
            properties: 
                { 
                    tags: 
                        { 
                            DevOwner: devOwner,
                            CreatedBy: userName
                        }
                    }
                }).catch(error => {
                    context.log.verbose("error assigning DevOwner tag: " + error.message);
                    end(500, "error assigning DevOwner tag:  " + error.message, "error");
                });

    end(200, "Resource group: " + rgName + "; Owner: " + userName, "verbose");

    function shouldRespondToEvent(eventPayload) {
        try {
            var subStatus = eventPayload.context.activityLog.subStatus;
        }
        catch (err) {
            return false;
        }

        if (subStatus == "Created") {
            return true;
        }
        return false;
    }

    function end(httpStatus, message, level) {
        if (level == 'error') {
            context.log.error(message);
        }
        if (level == 'verbose') {
            context.log.verbose(message);
        }
        context.res = {
            status: httpStatus,
            body: message
        };
        context.done();
    }

    function createCredentials() {
        var environment = process.env.AZURE_FUNCTIONS_ENVIRONMENT;
        var credential;
        if (typeof environment !== 'undefined' && environment === 'Development') {
            credential = new AzureCliCredential()
        } else {
            credential = new ManagedIdentityCredential();
        }
    
        return credential;
    }    
}