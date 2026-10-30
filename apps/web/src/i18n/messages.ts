/** Dynamic UI messages and API responses; captured names/amounts remain unchanged. */
export const messages: Record<string, string> = {
  "Invalid secret key. You don't have permission to create admin accounts.":
    'Ufunguo wa siri si sahihi. Huna ruhusa ya kufungua akaunti za wasimamizi.',
  'Transaction not found': 'Muamala haujapatikana',
  'Transaction not found or not flagged as fraud':
    'Muamala haujapatikana au hauna alama ya udanganyifu',
  'Transaction already reviewed': 'Muamala tayari umekaguliwa',
  'Amount must be greater than 0': 'Kiasi lazima kiwe kikubwa kuliko 0',
  'You cannot send money to yourself': 'Huwezi kujitumia pesa mwenyewe',
  'Invalid receiver selected': 'Mpokeaji aliyechaguliwa si halali',
  'User is already approved': 'Mtumiaji tayari ameidhinishwa',
  'User is already disapproved': 'Mtumiaji tayari ameondolewa idhini',
  'User is already activated': 'Akaunti ya mtumiaji tayari imewezeshwa',
  'User is already deactivated': 'Akaunti ya mtumiaji tayari imesitishwa',
  'Try again in {0}m {1}s.': 'Jaribu tena baada ya dakika {0} na sekunde {1}.',
  'Link expires in {0} minutes and {1} seconds.':
    'Muda wa kiungo unaisha baada ya dakika {0} na sekunde {1}.',
  'User created successfully! Account is active.':
    'Akaunti ya mtumiaji imefunguliwa! Akaunti inatumika.',
  'User created successfully! Account requires approval.':
    'Akaunti ya mtumiaji imefunguliwa! Akaunti inahitaji idhini.',
  'Please use at least {0} characters.': 'Tafadhali tumia angalau vibambo {0}.',
  'Please enter a value of at least {0}.': 'Tafadhali weka kiasi cha angalau {0}.',
  'Please enter a value no greater than {0}.': 'Tafadhali weka kiasi kisichozidi {0}.',
  'Activate {0}?': 'Uwezeshe akaunti ya {0}?',
  'Approve {0}?': 'Uidhinishe {0}?',
  'Deactivate {0}?': 'Usitishe akaunti ya {0}?',
  'Delete {0}?': 'Ufute {0}?',
  'Disapprove {0}?': 'Uondoe idhini ya {0}?',
  'Are you sure you want to approve {0}?': 'Una uhakika unataka kumuidhinisha {0}?',
  "Add {0} ({1}) to {2}'s account?\n\nReason: {3}\nNew balance: {4}":
    'Uongeze {0} ({1}) kwenye akaunti ya {2}?\n\nSababu: {3}\nSalio jipya: {4}',
  'Available balance: {0}': 'Salio linalopatikana: {0}',
  'Choose a new password for {0}.': 'Chagua nenosiri jipya la {0}.',
  'Create this user account with {0} security questions answered?':
    'Ufungue akaunti hii ya mtumiaji yenye maswali {0} ya usalama yaliyojibiwa?',
  'Fraud Alerts ({0})': 'Tahadhari za udanganyifu ({0})',
  'Pending Approvals ({0})': 'Idhini zinazosubiri ({0})',
  'Incorrect answers. Please try again. ({0}/3 correct)':
    'Majibu si sahihi. Tafadhali jaribu tena. ({0}/3 ni sahihi)',
  'Insufficient balance. Your balance is {0}': 'Salio halitoshi. Salio lako ni {0}',
  'Invalid user credentials. {0} attempt(s) remaining before lockout.':
    'Taarifa za kuingia za mtumiaji si sahihi. Yamebaki majaribio {0} kabla ya kufungwa.',
  'Invalid admin credentials. {0} attempt(s) remaining before lockout.':
    'Taarifa za kuingia za msimamizi si sahihi. Yamebaki majaribio {0} kabla ya kufungwa.',
  'Manage user funds: {0}': 'Simamia pesa za mtumiaji: {0}',
  'Page {0}': 'Ukurasa {0}',
  'Request failed ({0})': 'Ombi limeshindikana ({0})',
  'Risk score {0}%': 'Alama ya hatari {0}%',
  'Security questions set: {0} answered': 'Maswali ya usalama: {0} yamejibiwa',
  'The recipient has received from {0} different senders in the last 7 minutes.\nSending to this recipient will result in the account being blocked. Continue?':
    'Mpokeaji amepokea kutoka kwa watumaji {0} tofauti katika dakika 7 zilizopita.\nKutuma kwa mpokeaji huyu kutasababisha akaunti kuzuiwa. Uendelee?',
  'Too many failed attempts. Account locked for {0} minute(s).':
    'Majaribio mengi yameshindikana. Akaunti imefungwa kwa dakika {0}.',
  'Transaction successful! You sent {0} to {1}': 'Muamala umefanikiwa! Umetuma {0} kwa {1}',
  'Transaction {0} marked as reviewed': 'Muamala {0} umewekewa alama ya kukaguliwa',
  'Transactions ({0})': 'Miamala ({0})',
  'Welcome back, {0}!': 'Karibu tena, {0}!',
  'Withdrawal successful! You withdrew {0}': 'Utoaji pesa umefanikiwa! Umetoa {0}',
  'You are about to send {0} to the selected recipient. Continue?':
    'Unakaribia kutuma {0} kwa mpokeaji uliyemchagua. Uendelee?',
  'You are about to withdraw {0}. Continue?': 'Unakaribia kutoa {0}. Uendelee?',
  'You have made {0} large transactions totaling {1} in the last 5 minutes.\nThis transaction will make {2} transactions totaling {3}.\nIf this exceeds 3 transactions or 10,000,000 TSh, it will be BLOCKED. Continue?':
    'Umefanya miamala mikubwa {0} yenye jumla ya {1} katika dakika 5 zilizopita.\nMuamala huu utafanya jumla kuwa miamala {2} ya {3}.\nIkizidi miamala 3 au TSh 10,000,000, UTAZUIWA. Uendelee?',
  'You have sent to {0} recipients in the last 5 minutes.\nSending to another recipient will result in your account being blocked. Continue?':
    'Umetuma kwa wapokeaji {0} katika dakika 5 zilizopita.\nKutuma kwa mpokeaji mwingine kutasababisha akaunti yako kuzuiwa. Uendelee?',
  'You have {0} consecutive failed withdrawal attempts. Withdrawals are temporarily blocked. Please contact support to unblock your account.':
    'Una majaribio {0} ya kutoa pesa yaliyoshindikana mfululizo. Utoaji pesa umezuiwa kwa muda. Tafadhali wasiliana na huduma kwa wateja ili kufungua akaunti yako.',
  'Your account is locked. Please wait {0} minute(s) before trying again.':
    'Akaunti yako imefungwa. Tafadhali subiri dakika {0} kabla ya kujaribu tena.',
  'Received from {0}': 'Imepokelewa kutoka kwa {0}',
  'Sent to {0}': 'Imetumwa kwa {0}',
  'More actions for {0}': 'Vitendo zaidi kwa {0}',
  'Showing {0} of {1} users': 'Inaonyesha watumiaji {0} kati ya {1}',
  '{0} analyzed · avg {1}% · Highest: {2}%': '{0} imechambuliwa · wastani {1}% · Juu zaidi: {2}%',
  '{0}% of total': '{0}% ya jumla',
  'Range: {0}% – {1}%': 'Wigo: {0}% – {1}%',
  'Location changed from {0} to {1} ({2} away) in {3} minutes':
    'Eneo limebadilika kutoka {0} hadi {1} (umbali wa {2}) ndani ya dakika {3}',
  'This action is permanent and cannot be undone.\n\n{0} ({1}) will be removed.':
    'Kitendo hiki ni cha kudumu na hakiwezi kubatilishwa.\n\n{0} ({1}) ataondolewa.',
  'You have {0} previous failed attempts. One more failed attempt will block your withdrawals.\n\nYou are about to withdraw {1}. Continue?':
    'Una majaribio {0} yaliyoshindikana awali. Jaribio lingine likishindikana utoaji wako wa pesa utazuiwa.\n\nUnakaribia kutoa {1}. Uendelee?',
  "Successfully added {0} to {1}'s account!": 'Imefanikiwa kuongeza {0} kwenye akaunti ya {1}!',
  'The recipient has reached the maximum of {0} senders in 7 minutes. This transaction will be BLOCKED.':
    'Mpokeaji amefikia kikomo cha watumaji {0} ndani ya dakika 7. Muamala huu UTAZUIWA.',
  'You have reached the maximum of {0} recipients in 5 minutes. This transaction will be BLOCKED.':
    'Umefikia kikomo cha wapokeaji {0} ndani ya dakika 5. Muamala huu UTAZUIWA.',
  'Transaction BLOCKED due to fraud detection.':
    'Muamala UMEZUIWA kutokana na kugunduliwa kwa udanganyifu.',
  'Withdrawal BLOCKED due to fraud detection.':
    'Utoaji pesa UMEZUIWA kutokana na kugunduliwa kwa udanganyifu.',
  'Risk Score: {0}%': 'Alama ya hatari: {0}%',
  'Risk Level: HIGH': 'Kiwango cha hatari: KIKUBWA',
  'Risk Level: MEDIUM': 'Kiwango cha hatari: WASTANI',
  'Risk Level: LOW': 'Kiwango cha hatari: KIDOGO',
  'Reason: Multiple failed withdrawal attempts detected':
    'Sababu: Majaribio mengi ya kutoa pesa yaliyoshindikana yamegunduliwa',
  'Reason: Abnormal transaction at unusual hour with large amount':
    'Sababu: Muamala usio wa kawaida wa kiasi kikubwa katika saa isiyo ya kawaida',
  'Reason: Suspicious location change with large transaction':
    'Sababu: Mabadiliko ya eneo yanayotiliwa shaka pamoja na muamala mkubwa',
  'Reason: Transaction amount exceeds security threshold':
    'Sababu: Kiasi cha muamala kimezidi kikomo cha usalama',
  'Reason: Multiple large transactions detected in short period':
    'Sababu: Miamala mikubwa mingi imegunduliwa ndani ya muda mfupi',
  'Reason: Abnormal withdrawal at unusual hour with large amount':
    'Sababu: Utoaji wa kiasi kikubwa katika saa isiyo ya kawaida',
  'Reason: Suspicious location change with large withdrawal':
    'Sababu: Mabadiliko ya eneo yanayotiliwa shaka pamoja na utoaji mkubwa wa pesa',
  'Reason: Attempting to withdraw more than 90% of balance':
    'Sababu: Jaribio la kutoa zaidi ya 90% ya salio',
  'Reason: Withdrawal amount exceeds security threshold':
    'Sababu: Kiasi cha kutoa pesa kimezidi kikomo cha usalama',
  'Please contact support if you believe this is a mistake.':
    'Tafadhali wasiliana na huduma kwa wateja ikiwa unaamini hili ni kosa.',
  'You have sent money to {0} different recipients in the last 5 minutes.':
    'Umetuma pesa kwa wapokeaji {0} tofauti katika dakika 5 zilizopita.',
  'You have made {0} large transactions totaling {1} in the last 5 minutes.':
    'Umefanya miamala mikubwa {0} yenye jumla ya {1} katika dakika 5 zilizopita.',
  'The recipient has received money from {0} different senders in the last 7 minutes.':
    'Mpokeaji amepokea pesa kutoka kwa watumaji {0} tofauti katika dakika 7 zilizopita.',
  'Maximum allowed: {0} recipients per 5 minutes.': 'Kikomo: wapokeaji {0} kwa dakika 5.',
  'Maximum allowed: {0} senders per 7 minutes.': 'Kikomo: watumaji {0} kwa dakika 7.',
  'Maximum allowed: 3 large transactions totaling 10,000,000 TSh per 5 minutes.':
    'Kikomo: miamala mikubwa 3 yenye jumla ya TSh 10,000,000 kwa dakika 5.',
  'Please wait a few minutes before sending again.':
    'Tafadhali subiri dakika chache kabla ya kutuma tena.',
  'Please wait a few minutes before trying again.':
    'Tafadhali subiri dakika chache kabla ya kujaribu tena.',
  'Please wait a few minutes before sending to this recipient.':
    'Tafadhali subiri dakika chache kabla ya kutuma kwa mpokeaji huyu.',
  'Your withdrawals are temporarily blocked due to multiple consecutive failed withdrawal attempts.':
    'Utoaji wako wa pesa umezuiwa kwa muda kutokana na majaribio mengi yaliyoshindikana mfululizo.',
  'Please contact support to unblock your account.':
    'Tafadhali wasiliana na huduma kwa wateja ili kufungua akaunti yako.',
  'Insufficient balance. Please try a lower amount.':
    'Salio halitoshi. Tafadhali jaribu kiasi kidogo zaidi.',
  'Incorrect password': 'Nenosiri si sahihi',
  'Please sign in': 'Tafadhali ingia',
  'Your account is no longer active': 'Akaunti yako haitumiki tena',
  'Your account has been deactivated. Please contact support.':
    'Akaunti yako imesitishwa. Tafadhali wasiliana na huduma kwa wateja.',
  'Your account is pending admin approval. Please wait for confirmation.':
    'Akaunti yako inasubiri idhini ya msimamizi. Tafadhali subiri uthibitisho.',
  "Registration successful. Your account is pending admin approval — you'll be notified once it's reviewed.":
    'Usajili umefanikiwa. Akaunti yako inasubiri idhini ya msimamizi — utaarifiwa baada ya ukaguzi.',
  'Email, phone number, or card number already exists':
    'Barua pepe, namba ya simu au namba ya kadi tayari imesajiliwa',
  'Username or email already exists': 'Jina la mtumiaji au barua pepe tayari imesajiliwa',
  'Invalid secret key. Admin registration is restricted.':
    'Ufunguo wa siri si sahihi. Usajili wa msimamizi una masharti.',
  'Admin account created successfully! You can now login.':
    'Akaunti ya msimamizi imefunguliwa! Sasa unaweza kuingia.',
  'Email not found. Please check your email address.':
    'Barua pepe haijapatikana. Tafadhali hakiki anwani yako ya barua pepe.',
  "Your account doesn't have sufficient security questions set up. Please contact support.":
    'Akaunti yako haina maswali ya kutosha ya usalama. Tafadhali wasiliana na huduma kwa wateja.',
  'Please answer at least 3 security questions.': 'Tafadhali jibu angalau maswali 3 ya usalama.',
  'Please answer at least 3 security questions': 'Tafadhali jibu angalau maswali 3 ya usalama',
  'Invalid reset token. Please request a new password reset.':
    'Kiungo cha kuweka upya si halali. Tafadhali omba kiungo kipya.',
  'Your reset token has expired (valid for 5 minutes). Please request a new one.':
    'Muda wa kiungo chako umeisha (hudumu dakika 5). Tafadhali omba kipya.',
  'Password reset successfully. You can now sign in with your new password.':
    'Nenosiri limewekwa upya. Sasa unaweza kuingia kwa nenosiri lako jipya.',
  'Your session expired. Please start again.':
    'Muda wa kipindi chako umeisha. Tafadhali anza tena.',
  'Full name must be at least 3 characters': 'Jina kamili lazima liwe na angalau vibambo 3',
  'Valid email is required': 'Barua pepe halali inahitajika',
  'Invalid email address': 'Anwani ya barua pepe si halali',
  'Phone must be 10-15 digits, e.g. +255712345678':
    'Simu lazima iwe na tarakimu 10–15, mfano +255712345678',
  'Card number must be 16-20 digits': 'Namba ya kadi lazima iwe na tarakimu 16–20',
  'Password must be at least 6 characters': 'Nenosiri lazima liwe na angalau vibambo 6',
  'Password must be at least 8 characters': 'Nenosiri lazima liwe na angalau vibambo 8',
  'Password must contain an uppercase letter': 'Nenosiri lazima liwe na herufi kubwa',
  'Password must contain a lowercase letter': 'Nenosiri lazima liwe na herufi ndogo',
  'Password must contain a digit': 'Nenosiri lazima liwe na namba',
  'Password must contain a special character': 'Nenosiri lazima liwe na alama maalumu',
  'Username must be at least 3 letters, digits or underscores':
    'Jina la mtumiaji lazima liwe na angalau herufi, namba au vistari vya chini 3',
  'Login is required': 'Taarifa ya kuingia inahitajika',
  'Password is required': 'Nenosiri linahitajika',
  'Amount may have at most two decimal places':
    'Kiasi kinaweza kuwa na nafasi mbili tu za desimali',
  'Expected YYYY-MM-DD': 'Tumia muundo YYYY-MM-DD',
  'Too small: expected number to be >0': 'Kiasi lazima kiwe kikubwa kuliko 0',
  'Too small: expected string to have >={0} characters':
    'Taarifa lazima iwe na angalau vibambo {0}',
  'Too big: expected number to be <={0}': 'Kiasi hakiwezi kuzidi {0}',
  'User approved successfully!': 'Mtumiaji ameidhinishwa!',
  'User disapproved successfully!': 'Idhini ya mtumiaji imeondolewa!',
  'User activated successfully!': 'Akaunti ya mtumiaji imewezeshwa!',
  'User deactivated successfully!': 'Akaunti ya mtumiaji imesitishwa!',
  'User rejected and removed.': 'Mtumiaji amekataliwa na kuondolewa.',
  'User deleted successfully!': 'Mtumiaji amefutwa!',
  'User created successfully!': 'Akaunti ya mtumiaji imefunguliwa!',
  'User not found!': 'Mtumiaji hajapatikana!',
  'Only pending users can be rejected': 'Watumiaji wanaosubiri idhini tu ndio wanaoweza kukataliwa',
  'Failed to process withdrawal': 'Imeshindwa kushughulikia utoaji pesa',
  'Failed to deduct balance': 'Imeshindwa kukata salio',
  'Internal server error': 'Hitilafu ya ndani ya seva',
  'The server returned an invalid response': 'Seva imerudisha jibu lisilo halali',
};
