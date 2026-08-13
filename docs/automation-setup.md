# Email Automation Setup Guide (Master Sheet Version)

This guide explains how to install the Google Apps Script directly into your Shuddhi-Moolam Master Sheet. This will give you a convenient manual "Run" button in the spreadsheet UI, in addition to running automatically in the background via Gmail label filters.

## Step 1: Create the Gmail Filter
Instead of hardcoding sender emails into the code, we use Gmail's native filters to tag incoming newsletters.
1. Open your Gmail inbox (`sk@pmacindia.com` or `mvsaikishore@gmail.com`).
2. Click the **Show search options** icon (the sliders next to the search bar).
3. In the "From" field, enter: `sk@pmacindia.com OR mvsaikishore@gmail.com`.
4. Check the box for **Has attachment**.
5. Click **Create filter**.
6. Check **Apply the label:**, click "Choose label", and select **New label...**
7. Name the new label exactly: `MMR_Automation`.
8. Click **Create filter** to save.

## Step 2: Open the Master Sheet Script Editor
*(Note: Because the script is environment-aware, you can paste the exact same code into all 3 of your Master Sheets (`dev`, `staging`, and `prod`). It will automatically detect which sheet it is running from and route the PDF to the correct Drive folder!)*

1. Open the **Shuddhi-Moolam Master Sheet** in Google Sheets.
2. In the top menu, click **Extensions > Apps Script**.
3. A new tab will open titled "Untitled project". Rename it to **"Shuddhi-Moolam Newsletter Automation"**.

## Step 3: Paste the Code
1. Delete the empty `function myFunction() { ... }` that appears by default.
2. Copy the entire contents of `scripts/gmail_to_drive.gs` from this repository.
3. Paste the code into the editor.
4. Click the **Save** icon (the floppy disk) or press `Ctrl+S` / `Cmd+S`.

## Step 4: Authorize and Test the Custom Menu
1. Go back to your Google Sheet tab and **refresh the page**.
2. Wait a few seconds. A new menu item named **Shuddhi-Moolam** will appear at the top, right next to "Help".
3. Click **Shuddhi-Moolam > Process Newsletters**.
4. The first time you click this, a popup will appear saying "Authorization required". 
   - Click **Continue**.
   - Choose your Google account.
   - Click **Advanced**, then **Go to Shuddhi-Moolam Newsletter Automation (unsafe)**.
   - Click **Allow**.
5. Now, whenever you know a newsletter just arrived, you can simply click that menu button to instantly extract the PDF! You will see a success popup confirming how many were processed.

## Step 5: Set the Background Schedule (Optional but Recommended)
To make this run automatically without you having to click the button:
1. Go back to the Apps Script editor tab.
2. On the left-hand sidebar, click on the **Triggers** icon (it looks like a clock or an alarm).
3. Click **+ Add Trigger** in the bottom right corner.
4. Set the following options:
   - **Choose which function to run:** `processMmrNewsletters`
   - **Choose which deployment should run:** `Head`
   - **Select event source:** `Time-driven`
   - **Select type of time based trigger:** `Minutes timer`
   - **Select minute interval:** `Every 15 minutes` (or pick any frequency you prefer).
5. Click **Save**.

You are completely finished! The pipeline is now fully automated and controllable directly from your spreadsheet.
