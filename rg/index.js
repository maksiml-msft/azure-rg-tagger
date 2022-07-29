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

    end(200, "done:" + rgName, "verbose");

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
}