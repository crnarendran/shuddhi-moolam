/**
 * Shuddhi-Moolam: Automated Newsletter Ingestion
 * 
 * This script searches Gmail for the weekly MMR newsletter, extracts the PDF
 * attachment, and saves it to the Master Google Drive under a dynamically
 * created year and month folder structure.
 */

// --- CONFIGURATION ---

// The Production Google Drive Root Folder ID for Shuddhi-Moolam
// (This is where the pipeline webhook listens for changes)
var DRIVE_ROOT_FOLDER_ID = '1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb';

// The search query to find unread newsletters
var GMAIL_SEARCH_QUERY = '(from:sk@pmacindia.com OR from:mvsaikishore@gmail.com) subject:"MMR weekly" has:attachment is:unread';

// ---------------------

function processMmrNewsletters() {
  // 1. Find emails matching the query
  var threads = GmailApp.search(GMAIL_SEARCH_QUERY);
  if (threads.length === 0) {
    Logger.log('No new newsletters found.');
    return;
  }

  // 2. Access the Shuddhi-Moolam Root Drive Folder
  var rootFolder = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
  
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
        
        for (var k = 0; k < attachments.length; k++) {
          var attachment = attachments[k];
          
          // Ensure it is a PDF
          if (attachment.getContentType() === 'application/pdf' || attachment.getName().toLowerCase().indexOf('.pdf') > -1) {
            
            // Save the PDF into the target folder
            var newFile = targetFolder.createFile(attachment.copyBlob());
            Logger.log('Saved PDF: ' + newFile.getName() + ' to ' + monthStr);
            
          }
        }
        
        // Mark the message as read so we don't process it again
        message.markRead();
      }
    }
  }
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
