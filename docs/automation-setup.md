# Email Automation Setup Guide

This guide explains how to install the Google Apps Script that automatically ingests the weekly MMR Newsletter from your Gmail and places it into the Shuddhi-Moolam Google Drive.

## Step 1: Open Google Apps Script
1. Go to [script.google.com](https://script.google.com/) while logged into the Google Account that receives the forwarded emails (e.g., `sk@pmacindia.com` or `mvsaikishore@gmail.com`).
2. Click **New project** in the top left.
3. Click on "Untitled project" at the top and rename it to **"Shuddhi-Moolam Newsletter Automation"**.

## Step 2: Paste the Code
1. Delete the empty `function myFunction() { ... }` that appears by default.
2. Copy the entire contents of `scripts/gmail_to_drive.gs` from this repository.
3. Paste the code into the editor.
4. Click the **Save** icon (the floppy disk) or press `Ctrl+S` / `Cmd+S`.

## Step 3: Run and Authorize
The first time you run this script, Google will ask for permission to access your Gmail and Drive.
1. At the top of the screen, make sure `processMmrNewsletters` is selected in the dropdown next to the "Run" and "Debug" buttons.
2. Click the **Run** button.
3. A popup will appear saying "Authorization required". Click **Review permissions**.
4. Choose your Google account.
5. You may see a warning screen saying "Google hasn't verified this app". Click **Advanced**, and then click **Go to Shuddhi-Moolam Newsletter Automation (unsafe)**.
6. Click **Allow** to grant it access to Gmail and Drive.
7. Once authorized, the script will run! If you have any unread MMR emails in your inbox, it will instantly move the PDFs to the correct folder in Drive!

## Step 4: Set the Schedule (Triggers)
To make this run automatically on a weekly basis, you need to set up a Trigger.
1. On the left-hand sidebar of the Apps Script dashboard, click on the **Triggers** icon (it looks like a clock or an alarm).
2. Click **+ Add Trigger** in the bottom right corner.
3. Set the following options:
   - **Choose which function to run:** `processMmrNewsletters`
   - **Choose which deployment should run:** `Head`
   - **Select event source:** `Time-driven`
   - **Select type of time based trigger:** `Week timer`
   - **Select day of week:** Pick the day you usually receive the email (e.g., `Monday`).
   - **Select time of day:** Pick a time window (e.g., `8am to 9am`).
4. Click **Save**.

*(Note: Alternatively, if you want it to process emails faster without waiting for a specific day, you can choose an "Hour timer" and set it to run "Every hour". It will quietly check your inbox every hour and only act when a new newsletter arrives.)*

You are completely finished! The pipeline is now fully automated.
