const logger = require("../Helpers/logger");
const database = require("../Services/databaseService");
const constants = require("../Helpers/constants");
const awsHelper = require("./../Helpers/awsHelper");
const {notify} = require("./../Helpers/notificationHelper");
const moment = require("moment");
const axios = require("axios");

class VaccineNotifier {
   constructor() {
   }

   async checkVaccineAvailability() {
      try {
         const response = await database.runSp(constants.SP_GET_ALL_USERS, []);
         const userDetails = response[0];
         if (userDetails.length > 0) {
            for (const user of userDetails) {
               const slots = await this._getAvailableSlots(user[constants.PINCODE], user[constants.AGE]);
               if (slots.length > 0) {
                  const msgBody = slots;
                  const subject = "IMPORTANT: VACCINE AVAILABLE AT " + user[constants.PINCODE];
                  await this._notify(msgBody, subject, user[constants.EMAIL_ADDRESS]);
               } else {
                  logger.info("No Slots Available for User: " + user[constants.EMAIL_ADDRESS]);
               }
            }
         } else {
            logger.info("No Users");
         }
      } catch (e) {
         logger.error(e.toString());
      }
   }

   /**
    * Method to get the available slots.
    * @param pincode: The Pincode for the slots.
    * @param age: the age of the customer.
    * @returns {Promise<Array>}
    * @private
    */
   async _getAvailableSlots(pincode, age) {
      try {
         const today = moment().format("DD-MM-YYYY");
         const url = constants.CO_WIN_API_URL + "?pincode=" + pincode + "&date=" + today;
         const response = await axios.get(url);
         const centers = response.data[constants.CENTERS];
         if (centers.length > 0) {
            let slotsArray = [];
            for (const center of centers) {
               const sessions = center[constants.SESSIONS];
               for (const session of sessions) {
                  const capacity = session[constants.AVAILABLE_CAPACITY];
                  const minAgeLimit = session[constants.MIN_AGE_LIMIT];
                  /*const vaccine = session[constants.VACCINE_NAME];
                  const slots = session[constants.SLOTS];
                  slotsArray.push({vaccine, slots});*/
                  if (capacity > 0 && age > minAgeLimit) {
                     const vaccine = session[constants.VACCINE_NAME];
                     const slots = session[constants.SLOTS];
                     slotsArray.push({vaccine, slots});
                  } else {
                     logger.info("Vaccine not available.");
                  }
               }
            }
            return slotsArray;
         } else {
            logger.info("No Centers available.");
            return [];
         }
      } catch (e) {
         logger.error(JSON.stringify(e));
         return [];
      }
   }

   async _notify(msgBody, msgSubject, address) {
      const response = await notify(msgSubject, JSON.stringify(msgBody), address);
      logger.info("Vaccine Notification Send Status: " + response);
   }
}

module.exports = VaccineNotifier;