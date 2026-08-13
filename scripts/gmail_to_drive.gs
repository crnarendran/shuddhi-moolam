/**
 * Shuddhi-Moolam: Automated Newsletter Ingestion
 * 
 * This script searches Gmail for the weekly MMR newsletter, extracts the PDF
 * attachment, and saves it to the Master Google Drive under a dynamically
 * created year and month folder structure.
 */

// --- CONFIGURATION ---

// The search query to find unread newsletters tagged by the Gmail Filter
var GMAIL_SEARCH_QUERY = 'label:MMR_Automation is:unread';

// Environment mapping: Master Sheet ID -> Drive Root Folder ID
var ENV_MAPPING = {
  // Production
  '1DNB8wkqGiVZ1fED4tSVI43PdNY6cY9NdYO6HsZJ-hoY': '1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb',
  // Staging
  '15xWbByMNZ8nyK9CObZfbQ-_YxGrUJEe8uwnIN4CpYcY': '19Dbuq7mq94oRninpgRmDLj7EGNmCqamb',
  // Dev
  '1XgYRTqWmiFoHmSrN-sWAxzDzxEl_YeKGeUk-XqMtpgE': '1rvSE-rAW2mf1krmCepYM9va9oHoFEDNN'
};

// ---------------------

/**
 * Creates the custom menu inside the Google Sheet when opened.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Shuddhi-Moolam')
    .addItem('Process Newsletters', 'manualTrigger')
    .addToUi();
}

/**
 * Triggered by the user clicking the custom menu button.
 */
function manualTrigger() {
  var ui = SpreadsheetApp.getUi();
  var resultCount = processMmrNewsletters();
  
  if (resultCount > 0) {
    ui.alert('Success', 'Processed ' + resultCount + ' newsletter(s) successfully!', ui.ButtonSet.OK);
  } else {
    ui.alert('Status', 'No new unread newsletters found with the MMR_Automation label.', ui.ButtonSet.OK);
  }
}

/**
 * Core processing logic. Also triggered by the Time-driven background trigger.
 * @returns {number} The number of emails successfully processed.
 */
function processMmrNewsletters() {
  var processedCount = 0;
  
  // 1. Determine the correct Drive folder based on the current Spreadsheet
  var sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var driveRootFolderId = ENV_MAPPING[sheetId];
  
  if (!driveRootFolderId) {
    Logger.log('Error: This spreadsheet ID (' + sheetId + ') is not recognized as a Shuddhi-Moolam Master Sheet.');
    return processedCount;
  }
  
  // 2. Find emails matching the query
  var threads = GmailApp.search(GMAIL_SEARCH_QUERY);
  if (threads.length === 0) {
    Logger.log('No new newsletters found.');
    return processedCount;
  }

  // 3. Access the Shuddhi-Moolam Root Drive Folder for this environment
  var rootFolder = DriveApp.getFolderById(driveRootFolderId);
  
  // 3. Determine current date for folder structure
  var now = new Date();
  var yearStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy");
  var monthStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "MM - MMM - yyyy");
  
  // Example: "2026"
  var yearFolder = getOrCreateSubfolder(rootFolder, yearStr);
  
  // Example: "08 - Aug - 2026"
  var targetFolder = getOrCreateSubfolder(yearFolder, monthStr);

  // 4. Process each email thread
  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    
    for (var j = 0; j < messages.length; j++) {
      var message = messages[j];
      
      // Only process if the message is unread
      if (message.isUnread()) {
        var attachments = message.getAttachments();
        var savedAny = false;
        
        for (var k = 0; k < attachments.length; k++) {
          var attachment = attachments[k];
          var attachmentName = attachment.getName().toUpperCase();
          
          // Ensure it is a PDF and matches the format MMRW<Date>.pdf
          if ((attachment.getContentType() === 'application/pdf' || attachmentName.indexOf('.PDF') > -1) && 
              attachmentName.indexOf('MMRW') === 0) {
            
            // Save the PDF into the target folder
            var newFile = targetFolder.createFile(attachment.copyBlob());
            Logger.log('Saved PDF: ' + newFile.getName() + ' to ' + monthStr);
            savedAny = true;
          }
        }
        
        // Mark the message as read so we don't process it again
        if (savedAny) {
          message.markRead();
          processedCount++;
        }
      }
    }
  }
  
  return processedCount;
}

/**
 * Helper function to find a subfolder by name, or create it if it doesn't exist.
 */
function getOrCreateSubfolder(parentFolder, folderName) {
  var folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    Logger.log('Creating new folder: ' + folderName);
    return parentFolder.createFolder(folderName);
  }
}
