export const DateTimeServer = () => {
    const date = new Date();
    
    // Get the Unix timestamp in milliseconds
    const unixTimeMilliseconds = date.getTime();
        
    // Convert it to Unix timestamp in seconds
    const unixTimeSeconds = Math.floor(unixTimeMilliseconds / 1000);
    
    return unixTimeSeconds;
}

export const DateTimeServerExpiration = (expiration: number) => {
    const date = new Date();

    // Get the Unix timestamp in milliseconds
    const unixTimeMilliseconds = date.getTime();

    // Convert it to Unix timestamp in seconds
    const unixTimeSeconds = Math.floor(unixTimeMilliseconds / 1000);

    // Add expiration days to the current timestamp (expiration * 24 * 60 * 60 seconds)
    const unixTimeSecondsWithExpiration = unixTimeSeconds + (expiration * 24 * 60 * 60);

    return unixTimeSecondsWithExpiration;
}

export const checktwentyfourhours = (datetimestamp: string): boolean => {

    // Assuming 'datetimestamp' is the stored timestamp string
    const timestampMs = Date.parse(datetimestamp);

    // If the input is invalid, treat it as not within 24 hours
    if (isNaN(timestampMs)) {
        return false;
    }

    // Calculate the difference in hours between the current time and the stored timestamp
    const hoursDifference = (Date.now() - timestampMs) / (1000 * 60 * 60);

    // Return true if less than 24 hours have passed, otherwise false
    return hoursDifference < 24;
}


export const AddUnixtimeDay = (unixtime: string, daystoadd: number) => {

    //  FOR TESTING PURPOSES
    // return parseFloat(unixtime) + (daystoadd * 60);

    return parseFloat(unixtime) + (daystoadd * 24 * 60 * 60);
}

export const RemainingTime = (startTime: string, claimDays: string) => {
    //  FOR TESTING PURPOSES
    // Convert the start time from Unix time (seconds) to milliseconds
    // const startTimeMilliseconds = parseFloat(startTime) * 1000;

    // // Convert claimDays to milliseconds, but scale 1 day to 1 minute for testing
    // const claimDaysMilliseconds = parseFloat(claimDays) * 60 * 1000;

    // // Calculate the target time by adding the claimDays to the startTime
    // const targetTimeMilliseconds = startTimeMilliseconds + claimDaysMilliseconds;

    // // Get the current time in milliseconds
    // const currentTimeMilliseconds = Date.now();

    // // Calculate the remaining time by subtracting the current time from the target time
    // const remainingTimeMilliseconds = targetTimeMilliseconds - currentTimeMilliseconds;

    // // If the remaining time is less than 0, it means the target time has passed
    // if (remainingTimeMilliseconds < 0) {
    //     return 0;
    // }

    // // Convert the remaining time to Unix timestamp in seconds
    // const remainingTimeSeconds = Math.floor(remainingTimeMilliseconds / 1000);

    // return remainingTimeSeconds;

    // Convert the start time from Unix time (seconds) to milliseconds
    const startTimeMilliseconds = parseFloat(startTime) * 1000;

    // Convert claimDays to milliseconds
    const claimDaysMilliseconds = parseFloat(claimDays) * 24 * 60 * 60 * 1000;

    // Calculate the target time by adding the claimDays to the startTime
    const targetTimeMilliseconds = startTimeMilliseconds + claimDaysMilliseconds;

    // Get the current time in milliseconds
    const currentTimeMilliseconds = Date.now();

    // Calculate the remaining time by subtracting the current time from the target time
    const remainingTimeMilliseconds = targetTimeMilliseconds - currentTimeMilliseconds;

    // If the remaining time is less than 0, it means the target time has passed
    if (remainingTimeMilliseconds < 0) {
        return 0;
    }

    // Convert the remaining time to Unix timestamp in seconds
    const remainingTimeSeconds = Math.floor(remainingTimeMilliseconds / 1000);

    return remainingTimeSeconds;
}

export const ManualDateTimeServer = (passeddate: string) => {
    const date = new Date(passeddate);

    // Get the Unix timestamp in milliseconds
    const unixTimeMilliseconds = date.getTime();
        
    // Convert it to Unix timestamp in seconds
    const unixTimeSeconds = Math.floor(unixTimeMilliseconds / 1000);
    
    return unixTimeSeconds;
}