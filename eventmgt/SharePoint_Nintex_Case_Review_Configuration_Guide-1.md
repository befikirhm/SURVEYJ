# SharePoint 2016 & Nintex Workflow 4.4.1.0 Case Review System
## Complete Configuration Guide

---

## TABLE OF CONTENTS

1. [SharePoint Site Structure](#1-sharepoint-site-structure)
2. [Role-Based Access Control (RBAC) - Permission Matrix](#2-role-based-access-control-rbac---permission-matrix)
3. [SharePoint Lists Configuration](#3-sharepoint-lists-configuration)
4. [Email Templates](#4-email-templates)
5. [Nintex Workflows - Detailed Configuration](#5-nintex-workflows---detailed-configuration)
6. [Feedback Dashboard Page](#6-feedback-dashboard-page)
7. [Document Automation](#7-document-automation)
8. [Testing Procedures](#8-testing-procedures)
9. [Troubleshooting Guide](#9-troubleshooting-guide)

---

## 1. SHAREPOINT SITE STRUCTURE

### 1.1 Site Hierarchy
```
Site: Case Review System
├── Lists
│   ├── Case Review
│   ├── Email Templates
│   └── Feedback Submissions
└── Document Libraries
    └── Case Documents
```

### 1.2 Pages
- **Home.aspx** - Default landing page with role-based web parts
- **FeedbackDashboard.aspx** - Filtered feedback view (critical requirement)
- **CaseManagement.aspx** - Workgroup case management view

---

## 2. ROLE-BASED ACCESS CONTROL (RBAC) - PERMISSION MATRIX

### 2.1 SharePoint Groups (Create These Groups)

| Group Name | Description | Members |
|------------|-------------|---------|
| **CRW Workgroup** | Case review workgroup members | Workgroup staff |
| **CRW Screening Team** | Screening team members | Screening staff |
| **CRW Supervisors** | Screening team supervisors | Supervisor staff |
| **CRW Service Teams** | Service teams submitting cases | Service team staff |
| **CRW Intake Team** | Intake service team | Intake staff |
| **CRW Administrators** | System administrators | IT/Admin staff |

### 2.2 Site-Level Permissions

| Group | Permission Level | Notes |
|-------|-----------------|-------|
| CRW Administrators | Full Control | Complete access |
| CRW Workgroup | Contribute | Can create/edit cases |
| CRW Screening Team | Read | Base permission (item-level overrides) |
| CRW Supervisors | Read | Base permission (item-level overrides) |
| CRW Service Teams | Read | Base permission (item-level overrides) |
| CRW Intake Team | Read | Base permission (item-level overrides) |

### 2.3 List/Library-Level Permissions (BREAK INHERITANCE)

#### 2.3.1 Case Review List
**Break inheritance immediately after creation**

| Group | Permission Level | Can View | Can Edit | Can Delete |
|-------|-----------------|----------|----------|------------|
| CRW Administrators | Full Control | All | All | All |
| CRW Workgroup | Contribute | All | All | Own items only |
| CRW Screening Team | Read | None* | None | None |
| CRW Supervisors | Read | None* | None | None |
| CRW Service Teams | Contribute | Own items* | Own items* | No |
| CRW Intake Team | Read | None* | None | None |

*See Item-Level Permissions below

**Versioning Settings:**
- Enable versioning: Yes
- Create major versions: Yes
- Draft item security: Only users who can edit items

**Advanced Settings:**
- Read access: Specify own
- Create and edit access: Create items and edit items that were created by the user

#### 2.3.2 Case Documents Library
**Break inheritance immediately after creation**

| Group | Permission Level | Folder Access |
|-------|-----------------|---------------|
| CRW Administrators | Full Control | All folders |
| CRW Workgroup | Contribute | All folders |
| CRW Screening Team | Read | None (folder-level override)* |
| CRW Supervisors | Read | None (folder-level override)* |
| CRW Service Teams | Contribute | Own case folders only* |
| CRW Intake Team | Read | None (folder-level override)* |

*Folder-level permissions set by workflow

**Library Settings:**
- Create major and minor versions: Yes
- Draft item security: Only users who can approve items
- Require content approval: No
- Require checkout: No

#### 2.3.3 Feedback Submissions List
**Break inheritance immediately after creation**

| Group | Permission Level | Can View | Can Create | Can Edit |
|-------|-----------------|----------|------------|----------|
| CRW Administrators | Full Control | All | Yes | All |
| CRW Workgroup | Contribute | All | Yes | All |
| CRW Screening Team | Contribute | Own items only* | Yes | Own items only* |
| CRW Supervisors | Read | Supervised items only* | No | No |
| CRW Service Teams | Read | Related items* | No | No |
| CRW Intake Team | Read | Related items* | No | No |

*Enforced via item-level permissions set by workflow

**Advanced Settings:**
- Read access: Read items that were created by the user
- Create and edit access: Create items and edit items that were created by the user

#### 2.3.4 Email Templates List
**DO NOT break inheritance - use site-level permissions**

| Group | Permission Level |
|-------|-----------------|
| CRW Administrators | Full Control |
| All other groups | Read (inherited) |

### 2.4 Item-Level Permissions (Set by Workflows)

#### 2.4.1 Case Review Items
**Set when Case Initialization workflow runs:**

```
For each Case Review item:
1. Break role inheritance (do not copy)
2. Grant permissions:
   - CRW Administrators: Full Control
   - CRW Workgroup: Contribute (all members)
   - Assigned Workgroup: Contribute (specific members)
   - Screening Team Members: Read (specific members from the case)
   - Supervisor: Read (specific supervisor from the case)
   - Intake Service Team Contact: Read (specific contact)
   - Service Teams: Contribute (IF Source = "Service Team Referral", grant to Created By user)
```

#### 2.4.2 Case Documents Folder Permissions
**Set when folder created in Case Initialization workflow:**

```
For each Case_[CaseID] folder:
1. Break role inheritance (do not copy)
2. Grant permissions:
   - CRW Administrators: Full Control
   - CRW Workgroup: Contribute (all members)
   - Assigned Workgroup: Contribute (specific members)
   - Screening Team Members: Read (specific members from the case)
   - Supervisor: Read (specific supervisor)
   - Intake Service Team Contact: Read (specific contact)
   - Service Teams: Contribute (IF Source = "Service Team Referral", grant to Created By user)
```

#### 2.4.3 Feedback Submissions Items
**Set when Feedback Manager workflow runs on item creation:**

```
For each Feedback Submission item:
1. Break role inheritance (do not copy)
2. Grant permissions:
   - CRW Administrators: Full Control
   - CRW Workgroup: Contribute (all members)
   - Screening Team Member: Contribute (specific member who created item)
   - Supervisor: Read (specific supervisor)
   - Intake Service Team Contact: Read (specific contact from parent case)
```

### 2.5 Permission Implementation Steps

#### Step 1: Create SharePoint Groups
```powershell
# Navigate to Site Settings → People and Groups
# Click "More..." → "New Group" for each group
# Configure each group:
#   - Group Settings: Who can view membership = Group Members
#   - Who can edit membership = Group Owner
#   - Allow requests to join/leave = No
```

#### Step 2: Break Inheritance on Lists/Libraries
```
For Case Review:
1. List Settings → Permissions for this list
2. Stop Inheriting Permissions
3. Remove all groups except Site Administrators
4. Add groups per matrix above
5. Advanced Settings → Item-level Permissions:
   - Read access: Read items that were created by the user
   - Create/Edit: Create items and edit items that were created by the user

For Case Documents:
1. Library Settings → Permissions for this document library
2. Stop Inheriting Permissions
3. Remove all groups except Site Administrators
4. Add groups per matrix above

For Feedback Submissions:
1. List Settings → Permissions for this list
2. Stop Inheriting Permissions
3. Remove all groups except Site Administrators
4. Add groups per matrix above
5. Advanced Settings → Item-level Permissions:
   - Read access: Read items that were created by the user
   - Create/Edit: Create items and edit items that were created by the user
```

#### Step 3: Verify Workflow Service Account Permissions
```
Ensure Nintex Workflow Service Account has:
- Full Control on Case Review list
- Full Control on Case Documents library
- Full Control on Feedback Submissions list
- Read on Email Templates list
```

---

## 3. SHAREPOINT LISTS CONFIGURATION

### 3.1 Case Review List

**Create as Custom List**

| Column Name | Type | Settings |
|-------------|------|----------|
| Title | Single line of text | Default (required) |
| Case ID | Single line of text | Required: Yes, Enforce unique values: Yes, Indexed: Yes |
| Case Name | Single line of text | Required: Yes |
| Case Status | Choice | Required: Yes<br>Choices: New, Documents Uploaded, Awaiting Feedback, Feedback Received, Feedback Compiled, Feedback Sent, Completed<br>Default: New |
| Date Identified | Date and Time | Required: Yes, Date only, Default: Today |
| Source | Choice | Required: Yes<br>Choices: Workgroup Selection, Service Team Referral |
| Assigned Workgroup | Person or Group | Required: Yes, Allow multiple: Yes, Show field: Name with picture |
| Screening Team Members | Person or Group | Required: Yes, Allow multiple: Yes, Show field: Name with picture |
| Intake Service Team Contact | Person or Group | Required: Yes, Allow multiple: No, Show field: Name with picture |
| Supervisor | Person or Group | Required: Yes, Allow multiple: No, Show field: Name with picture |
| Review Meeting Date | Date and Time | Required: No, Date and Time |
| Review Meeting Notes | Multiple lines of text | Required: No, Rich text, Enhanced rich text |
| Feedback Compiled Date | Date and Time | Required: No, Date and Time |
| Folder Name | Calculated | Formula: `="Case_"&[Case ID]`<br>Return type: Single line of text |
| Documents Link | Hyperlink | Required: No |
| All Feedback Received | Yes/No | Required: Yes, Default: No |
| Feedback Count | Number | Required: Yes, Default: 0, Min: 0, Decimal places: 0 |
| Expected Feedback Count | Number | Required: Yes, Default: 0, Min: 0, Decimal places: 0 |
| Themes Identified | Multiple lines of text | Required: No, Rich text |
| Theme Meeting Date | Date and Time | Required: No, Date and Time |
| Workflow Run Flag | Yes/No | Required: Yes, Default: No<br>(Hidden from forms, used to prevent duplicate workflow runs) |
| Feedback Request Sent | Yes/No | Required: Yes, Default: No<br>(Hidden from forms, used to track feedback request status) |

**List Settings:**
- Enable versioning: Yes (Major versions)
- Enable attachments: No
- Item-level permissions: Read items that were created by the user

**Create View: "All Cases"**
- Columns: Case ID, Case Name, Case Status, Date Identified, Source, Review Meeting Date
- Sort by: Date Identified (descending)
- Filter: None

**Create View: "My Cases" (for Screening Team Members)**
- Columns: Case ID, Case Name, Case Status, Date Identified, Feedback Count
- Filter: Screening Team Members equals [Me]
- Sort by: Date Identified (descending)

### 3.2 Case Documents Library

**Create as Document Library**

| Column Name | Type | Settings |
|-------------|------|----------|
| Title | Single line of text | Default, not required |
| Case ID | Lookup | Required: Yes<br>Get information from: Case Review<br>In this column: Case ID<br>Enforce relationship behavior: Restrict Delete<br>Indexed: Yes |
| Document Type | Choice | Required: Yes<br>Choices: AI Report, Safety Assessment, Safety Plan, Activity Logs, Phone Call Records, Intake Report, Compiled Feedback, Other<br>Default: Other |

**Library Settings:**
- Enable versioning: Yes (Major and Minor)
- Require content approval: No
- Create folders: Yes (will be created by workflow)
- Require checkout: No

**Create View: "By Case"**
- Columns: Name, Document Type, Case ID, Modified, Modified By
- Group by: Case ID
- Sort by: Modified (descending)

### 3.3 Email Templates List

**Create as Custom List**

| Column Name | Type | Settings |
|-------------|------|----------|
| Title | Single line of text | Default (required) - use as Template Name |
| Template Name | Single line of text | Required: Yes, Enforce unique values: Yes, Indexed: Yes |
| Template Type | Choice | Required: Yes<br>Choices: Case Assignment, Intake Feedback Request, Screening Feedback Request, Feedback Reminder, Individual Feedback Delivery, Additional Feedback Request |
| Email Subject | Single line of text | Required: Yes |
| Email Body | Multiple lines of text | Required: Yes, Enhanced rich text (allow HTML) |
| Active | Yes/No | Required: Yes, Default: Yes |

**List Settings:**
- Enable versioning: No
- Item-level permissions: Default (all can read)

### 3.4 Feedback Submissions List

**Create as Custom List**

| Column Name | Type | Settings |
|-------------|------|----------|
| Title | Single line of text | Default - auto-populated as "Feedback for [Case ID]" |
| Case ID | Lookup | Required: Yes<br>Get information from: Case Review<br>In this column: Case ID<br>Add columns: Case Name, Intake Service Team Contact<br>Enforce relationship behavior: Restrict Delete<br>Indexed: Yes |
| Screening Team Member | Person or Group | Required: Yes, Allow multiple: No, Show field: Name with picture |
| Supervisor | Person or Group | Required: Yes, Allow multiple: No, Show field: Name with picture |
| Feedback Text | Multiple lines of text | Required: No, Enhanced rich text |
| Feedback Document | Hyperlink | Required: No<br>Format URL as: Hyperlink |
| Submission Status | Choice | Required: Yes<br>Choices: Draft, Submitted, Compiled, Sent to Member<br>Default: Draft |
| Date Submitted | Date and Time | Required: No, Date and Time |
| Additional Feedback Requested | Yes/No | Required: Yes, Default: No |
| Additional Feedback Text | Multiple lines of text | Required: No, Enhanced rich text |
| Additional Feedback Date | Date and Time | Required: No, Date and Time |

**List Settings:**
- Enable versioning: Yes (Major versions)
- Item-level permissions: Read items that were created by the user

**Create View: "My Feedback"**
- Columns: Case ID, Submission Status, Date Submitted, Additional Feedback Requested
- Filter: Screening Team Member equals [Me] OR Created By equals [Me]
- Sort by: Date Submitted (descending)

**Create View: "Pending Submissions"**
- Columns: Case ID, Screening Team Member, Submission Status, Date Submitted
- Filter: Submission Status equals Draft OR Submission Status equals Submitted
- Sort by: Case ID

---

## 4. EMAIL TEMPLATES

### 4.1 Template Configuration

Create the following items in the Email Templates list with EXACT token usage:

#### Template 1: Case Assignment
```
Template Name: Case Assignment
Template Type: Case Assignment
Active: Yes

Email Subject:
Case Review Assignment - [CaseID] - [CaseName]

Email Body:
<p>You have been assigned to review the following case:</p>
<p><strong>Case ID:</strong> [CaseID]<br />
<strong>Case Name:</strong> [CaseName]<br />
<strong>Date Identified:</strong> [DateIdentified]<br />
<strong>Source:</strong> [Source]<br />
<strong>Review Meeting Date:</strong> [ReviewMeetingDate]</p>

<p><strong>Case Documents:</strong><br />
<a href="[DocumentsLink]">View Case Documents</a></p>

<p>Please begin reviewing the supporting materials and prepare for the scheduled meeting.</p>

<p>Thank you,<br />
Case Review System</p>
```

#### Template 2: Intake Feedback Request
```
Template Name: Intake Feedback Request
Template Type: Intake Feedback Request
Active: Yes

Email Subject:
Feedback Request - Case [CaseID] - [CaseName]

Email Body:
<p>Dear [IntakeContact],</p>

<p>The Case Review Workgroup is requesting your feedback on the following case:</p>

<p><strong>Case ID:</strong> [CaseID]<br />
<strong>Case Name:</strong> [CaseName]<br />
<strong>Date Identified:</strong> [DateIdentified]<br />
<strong>Review Meeting Date:</strong> [ReviewMeetingDate]</p>

<p><strong>Case Documents:</strong><br />
<a href="[DocumentsLink]">View Case Documents</a></p>

<p><strong>Submit Your Feedback:</strong><br />
<a href="[FeedbackLink]">Click here to submit feedback</a></p>

<p>Please provide your feedback by [ReviewMeetingDate].</p>

<p>Thank you for your collaboration,<br />
Case Review Workgroup</p>
```

#### Template 3: Screening Feedback Request
```
Template Name: Screening Feedback Request
Template Type: Screening Feedback Request
Active: Yes

Email Subject:
Case Review Feedback Request - [CaseID] - [CaseName]

Email Body:
<p>Dear [ScreeningMember],</p>

<p>You have been selected for case review feedback on the following case you worked:</p>

<p><strong>Case ID:</strong> [CaseID]<br />
<strong>Case Name:</strong> [CaseName]<br />
<strong>Date Identified:</strong> [DateIdentified]<br />
<strong>Your Supervisor:</strong> [Supervisor]<br />
<strong>Review Meeting Date:</strong> [ReviewMeetingDate]</p>

<p><strong>Case Documents:</strong><br />
<a href="[DocumentsLink]">View Case Documents</a></p>

<p><strong>Submit Your Feedback:</strong><br />
<a href="[FeedbackLink]">Click here to submit feedback</a></p>

<p>Please review the case materials and submit your feedback by [ReviewMeetingDate]. Your supervisor ([Supervisor]) has been copied on this request.</p>

<p>This is a secure environment where only you, your supervisor, and the case review workgroup can access your feedback.</p>

<p>Thank you,<br />
Case Review Workgroup</p>
```

#### Template 4: Feedback Reminder
```
Template Name: Feedback Reminder
Template Type: Feedback Reminder
Active: Yes

Email Subject:
REMINDER: Feedback Due Soon - Case [CaseID]

Email Body:
<p>Dear [ScreeningMember],</p>

<p>This is a reminder that feedback is due for the following case:</p>

<p><strong>Case ID:</strong> [CaseID]<br />
<strong>Case Name:</strong> [CaseName]<br />
<strong>Review Meeting Date:</strong> [ReviewMeetingDate]</p>

<p><strong>Submit Your Feedback:</strong><br />
<a href="[FeedbackLink]">Click here to submit feedback</a></p>

<p>If you have already submitted your feedback, please disregard this reminder.</p>

<p>Thank you,<br />
Case Review Workgroup</p>
```

#### Template 5: Individual Feedback Delivery
```
Template Name: Individual Feedback Delivery
Template Type: Individual Feedback Delivery
Active: Yes

Email Subject:
Case Review Feedback Summary - [CaseID] - [CaseName]

Email Body:
<p>Dear [ScreeningMember],</p>

<p>Thank you for your participation in the case review process. The workgroup has completed the feedback compilation for case [CaseID] - [CaseName].</p>

<p><strong>Your Compiled Feedback:</strong></p>
<p>[FeedbackContent]</p>

<p><strong>View Full Feedback Document:</strong><br />
<a href="[FeedbackLink]">Access your feedback</a></p>

<p>This feedback has been shared with you and your supervisor ([Supervisor]). If you have questions or need clarification, please contact the Case Review Workgroup.</p>

<p>Thank you for your dedication to continuous improvement,<br />
Case Review Workgroup</p>
```

#### Template 6: Additional Feedback Request
```
Template Name: Additional Feedback Request
Template Type: Additional Feedback Request
Active: Yes

Email Subject:
Additional Information Requested - Case [CaseID]

Email Body:
<p>Dear [ScreeningMember],</p>

<p>The Case Review Workgroup is requesting additional information for case [CaseID] - [CaseName].</p>

<p><strong>Request Details:</strong></p>
<p>[FeedbackContent]</p>

<p><strong>Update Your Feedback:</strong><br />
<a href="[FeedbackLink]">Click here to add additional information</a></p>

<p>Please provide the requested information at your earliest convenience.</p>

<p>Thank you,<br />
Case Review Workgroup</p>
```

### 4.2 Token Replacement Reference

| Token | Source | Notes |
|-------|--------|-------|
| [CaseID] | Case Review: Case ID | Always available |
| [CaseName] | Case Review: Case Name | Always available |
| [DateIdentified] | Case Review: Date Identified | Format as short date |
| [Source] | Case Review: Source | "Workgroup Selection" or "Service Team Referral" |
| [DocumentsLink] | Case Review: Documents Link | URL to case folder |
| [FeedbackLink] | Constructed URL | Links to NewForm or EditForm |
| [ScreeningMember] | Person field | Display name |
| [Supervisor] | Person field | Display name |
| [IntakeContact] | Person field | Display name |
| [ReviewMeetingDate] | Case Review: Review Meeting Date | Format as short date/time |
| [FeedbackContent] | Feedback Submissions: Feedback Text | HTML content |

---

## 5. NINTEX WORKFLOWS - DETAILED CONFIGURATION

### 5.1 Workflow 1: Case Initialization

**Workflow Name:** Case Initialization  
**Start Event:** Item Created (Case Review list)  
**Run as:** Workflow initiator  
**State:** Enabled

#### 5.1.1 Workflow Variables

| Variable Name | Type | Default Value |
|---------------|------|---------------|
| varCaseID | Single line of text | (empty) |
| varFolderName | Single line of text | (empty) |
| varFolderURL | Single line of text | (empty) |
| varDocumentsLink | Hyperlink | (empty) |
| varWorkflowRunFlag | Boolean | No |
| varExpectedCount | Number | 0 |
| varErrorMessage | Single line of text | (empty) |
| varScreeningMembersCount | Number | 0 |
| varCurrentUser | Person | (empty) |
| varAssignedWorkgroup | Person (collection) | (empty) |
| varScreeningMembers | Person (collection) | (empty) |
| varSupervisor | Person | (empty) |
| varIntakeContact | Person | (empty) |
| varSource | Single line of text | (empty) |
| varCreatedBy | Person | (empty) |

#### 5.1.2 Workflow Actions (Step-by-Step)

**ACTION 1: Check Workflow Run Flag**
```
Action: Query List
List: Case Review
CAML Query:
<Where>
  <And>
    <Eq><FieldRef Name='ID'/><Value Type='Counter'>[Current Item:ID]</Value></Eq>
    <Eq><FieldRef Name='Workflow_x0020_Run_x0020_Flag'/><Value Type='Boolean'>1</Value></Eq>
  </And>
</Where>
Store result in: varWorkflowRunFlag (as Yes/No)
```

**ACTION 2: Terminate if Already Run**
```
Action: Run If
Condition: varWorkflowRunFlag equals Yes
  Then: Terminate Workflow
```

**ACTION 3: Set Workflow Run Flag**
```
Action: Update Item
Update: Current Item
Fields:
  - Workflow Run Flag = Yes
```

**ACTION 4: Store Current Item Values**
```
Action: Set Variable
varCaseID = [Current Item:Case ID]
varFolderName = [Current Item:Folder Name]
varSource = [Current Item:Source]
varCreatedBy = [Current Item:Created By]
varAssignedWorkgroup = [Current Item:Assigned Workgroup]
varScreeningMembers = [Current Item:Screening Team Members]
varSupervisor = [Current Item:Supervisor]
varIntakeContact = [Current Item:Intake Service Team Contact]
```

**ACTION 5: Calculate Expected Feedback Count**
```
Action: Build String
Pattern: {varScreeningMembers}
Store in: varScreeningMembersCount (text)

Action: Regular Expression
Action: Replace
Pattern: ;#[^;]+
String: varScreeningMembersCount
Replacement: (empty)
Store result in: varScreeningMembersCount

Action: Collection Operation
Operation: Count
Collection: varScreeningMembers
Store result in: varExpectedCount

Note: Expected count = Number of Screening Team Members
```

**ACTION 6: Update Expected Feedback Count**
```
Action: Update Item
Update: Current Item
Fields:
  - Expected Feedback Count = varExpectedCount
```

**ACTION 7: Create Case Folder in Case Documents**
```
Action: Create Item
List: Case Documents
Content Type: Folder
Fields:
  - Name = {varFolderName}

Store item ID in: varFolderItemID
```

**ACTION 8: Build Documents Link URL**
```
Action: Build String
Pattern: {Common:Site URL}/Case Documents/Forms/AllItems.aspx?RootFolder={Common:Site URL}/Case Documents/{varFolderName}&FolderCTID=0x012000
Store in: varDocumentsLink
```

**ACTION 9: Update Case with Documents Link**
```
Action: Update Item
Update: Current Item
Fields:
  - Documents Link = {varDocumentsLink}, {varFolderName}
  - Case Status = Documents Uploaded
```

**ACTION 10: Break Inheritance on Case Item**
```
Action: Call Web Service
Web service URL: {Common:Site URL}/_vti_bin/Lists.asmx
Service: Lists
Method: UpdateListItems
Request:
<Batch OnError="Continue" ListVersion="1">
  <Method ID="1" Cmd="Update">
    <Field Name='ID'>{Current Item:ID}</Field>
    <Field Name='PermMask'>BreakRoleInheritance</Field>
  </Method>
</Batch>
```

**ACTION 11: Grant Permissions - Administrators**
```
Action: Call Web Service (repeated for each permission group)
Web service URL: {Common:Site URL}/_vti_bin/Permissions.asmx
Method: AddPermission
Parameters:
  - objectName: Case Review
  - objectType: List
  - listItemID: {Current Item:ID}
  - principalName: CRW Administrators
  - permissionMask: FullMask
```

**ACTION 12: Grant Permissions - Workgroup**
```
Action: Call Web Service
[Same as above, but:]
  - principalName: CRW Workgroup
  - permissionMask: EditListItems
```

**ACTION 13: Grant Permissions - Assigned Workgroup Members**
```
Action: For Each (loop through varAssignedWorkgroup)
  Store current item in: varCurrentUser
  
  Action: Call Web Service
  [Same pattern as above]
    - principalName: {varCurrentUser}
    - permissionMask: EditListItems
```

**ACTION 14: Grant Permissions - Screening Team Members**
```
Action: For Each (loop through varScreeningMembers)
  Store current item in: varCurrentUser
  
  Action: Call Web Service
  [Same pattern as above]
    - principalName: {varCurrentUser}
    - permissionMask: ViewListItems
```

**ACTION 15: Grant Permissions - Supervisor**
```
Action: Call Web Service
[Same pattern as above]
  - principalName: {varSupervisor}
  - permissionMask: ViewListItems
```

**ACTION 16: Grant Permissions - Intake Contact**
```
Action: Call Web Service
[Same pattern as above]
  - principalName: {varIntakeContact}
  - permissionMask: ViewListItems
```

**ACTION 17: Grant Permissions - Service Team (if referral)**
```
Action: Run If
Condition: varSource equals "Service Team Referral"
  Then:
    Action: Call Web Service
    [Same pattern as above]
      - principalName: {varCreatedBy}
      - permissionMask: EditListItems
```

**ACTION 18: Break Inheritance on Case Folder**
```
Action: Call Web Service
Web service URL: {Common:Site URL}/_vti_bin/Lists.asmx
Service: Lists
Method: UpdateListItems
List: Case Documents
Request:
<Batch OnError="Continue">
  <Method ID="1" Cmd="Update">
    <Field Name='ID'>{varFolderItemID}</Field>
    <Field Name='PermMask'>BreakRoleInheritance</Field>
  </Method>
</Batch>
```

**ACTION 19-25: Grant Folder Permissions (Same Pattern as Case Item)**
```
[Repeat ACTION 11-17 but for Case Documents library and folder item]
Use same permission groups and levels
```

**ACTION 26: Send Email to Assigned Workgroup**
```
Action: Query List
List: Email Templates
Filter: Template Name equals "Case Assignment" AND Active equals Yes
Store first item in: varTemplateItem

Action: Set Variable
varEmailSubject = {varTemplateItem:Email Subject}
varEmailBody = {varTemplateItem:Email Body}

Action: Regular Expression - Replace Tokens
Pattern: \[CaseID\]
String: varEmailSubject
Replacement: {varCaseID}
Store in: varEmailSubject

[Repeat for all tokens in subject]

Action: Regular Expression - Replace Tokens
Pattern: \[CaseID\]
String: varEmailBody
Replacement: {varCaseID}
Store in: varEmailBody

[Repeat token replacement for:]
- \[CaseName\] → {Current Item:Case Name}
- \[DateIdentified\] → {Current Item:Date Identified}
- \[Source\] → {varSource}
- \[DocumentsLink\] → {varDocumentsLink}
- \[ReviewMeetingDate\] → {Current Item:Review Meeting Date}

Action: Send Email
To: {varAssignedWorkgroup}
Subject: {varEmailSubject}
Body: {varEmailBody}
```

**ACTION 27: Log Completion**
```
Action: Log to History List
Message: Case Initialization completed for Case ID: {varCaseID}. Folder created, permissions set, workgroup notified.
```

---

### 5.2 Workflow 2: Request Feedback

**Workflow Name:** Request Feedback  
**Start Event:** Item Modified (Case Review list)  
**Start Condition:** Case Status equals "Awaiting Feedback"  
**Run as:** Workflow owner  
**State:** Enabled

#### 5.2.1 Workflow Variables

| Variable Name | Type | Default Value |
|---------------|------|---------------|
| varCaseID | Single line of text | (empty) |
| varCaseName | Single line of text | (empty) |
| varDateIdentified | Date | (empty) |
| varReviewMeetingDate | Date | (empty) |
| varDocumentsLink | Hyperlink | (empty) |
| varScreeningMembers | Person (collection) | (empty) |
| varIntakeContact | Person | (empty) |
| varSupervisor | Person | (empty) |
| varCurrentScreeningMember | Person | (empty) |
| varFeedbackLink | Hyperlink | (empty) |
| varEmailSubject | Multiple lines | (empty) |
| varEmailBody | Multiple lines | (empty) |
| varFeedbackRequestSent | Boolean | No |

#### 5.2.2 Workflow Actions (Step-by-Step)

**ACTION 1: Check if Feedback Request Already Sent**
```
Action: Query List
List: Case Review
CAML:
<Where>
  <And>
    <Eq><FieldRef Name='ID'/><Value Type='Counter'>[Current Item:ID]</Value></Eq>
    <Eq><FieldRef Name='Feedback_x0020_Request_x0020_Sent'/><Value Type='Boolean'>1</Value></Eq>
  </And>
</Where>
Store result count in: varFeedbackRequestSent (as count)
```

**ACTION 2: Terminate if Already Sent**
```
Action: Run If
Condition: varFeedbackRequestSent greater than 0
  Then: Terminate Workflow
```

**ACTION 3: Store Current Item Values**
```
Action: Set Variable
varCaseID = [Current Item:Case ID]
varCaseName = [Current Item:Case Name]
varDateIdentified = [Current Item:Date Identified]
varReviewMeetingDate = [Current Item:Review Meeting Date]
varDocumentsLink = [Current Item:Documents Link]
varScreeningMembers = [Current Item:Screening Team Members]
varIntakeContact = [Current Item:Intake Service Team Contact]
varSupervisor = [Current Item:Supervisor]
```

**ACTION 4: Send Email to Intake Service Team**
```
Action: Query List
List: Email Templates
Filter: Template Type equals "Intake Feedback Request" AND Active equals Yes
Store first item in: varTemplateItem

Action: Set Variable
varEmailSubject = {varTemplateItem:Email Subject}
varEmailBody = {varTemplateItem:Email Body}

Action: Regular Expression - Replace All Tokens
[Replace these patterns in both Subject and Body:]
- \[CaseID\] → {varCaseID}
- \[CaseName\] → {varCaseName}
- \[DateIdentified\] → {varDateIdentified}
- \[ReviewMeetingDate\] → {varReviewMeetingDate}
- \[DocumentsLink\] → {varDocumentsLink}
- \[IntakeContact\] → {varIntakeContact:Display Name}

Action: Build String (for FeedbackLink)
Pattern: {Common:Site URL}/Lists/Feedback Submissions/NewForm.aspx?Source={Common:Site URL}/SitePages/FeedbackDashboard.aspx&Case_x0020_ID={varCaseID}
Store in: varFeedbackLink

Action: Regular Expression
Pattern: \[FeedbackLink\]
String: varEmailBody
Replacement: {varFeedbackLink}
Store in: varEmailBody

Action: Send Email
To: {varIntakeContact}
CC: {Current Item:Assigned Workgroup}
Subject: {varEmailSubject}
Body: {varEmailBody}
```

**ACTION 5: Loop Through Screening Team Members**
```
Action: For Each
Collection: varScreeningMembers
Store current item in: varCurrentScreeningMember

  ACTION 5a: Load Screening Feedback Request Template
  Action: Query List
  List: Email Templates
  Filter: Template Type equals "Screening Feedback Request" AND Active equals Yes
  Store first item in: varTemplateItem

  ACTION 5b: Build Email Subject and Body
  Action: Set Variable
  varEmailSubject = {varTemplateItem:Email Subject}
  varEmailBody = {varTemplateItem:Email Body}

  ACTION 5c: Replace Tokens
  [Replace in both Subject and Body:]
  - \[CaseID\] → {varCaseID}
  - \[CaseName\] → {varCaseName}
  - \[DateIdentified\] → {varDateIdentified}
  - \[ReviewMeetingDate\] → {varReviewMeetingDate}
  - \[DocumentsLink\] → {varDocumentsLink}
  - \[ScreeningMember\] → {varCurrentScreeningMember:Display Name}
  - \[Supervisor\] → {varSupervisor:Display Name}

  ACTION 5d: Build Feedback Link for This Member
  Action: Build String
  Pattern: {Common:Site URL}/Lists/Feedback Submissions/NewForm.aspx?Source={Common:Site URL}/SitePages/FeedbackDashboard.aspx&Case_x0020_ID={varCaseID}
  Store in: varFeedbackLink

  ACTION 5e: Replace FeedbackLink Token
  Action: Regular Expression
  Pattern: \[FeedbackLink\]
  String: varEmailBody
  Replacement: {varFeedbackLink}
  Store in: varEmailBody

  ACTION 5f: Send Email to Screening Member
  Action: Send Email
  To: {varCurrentScreeningMember}
  CC: {varSupervisor}, {Current Item:Assigned Workgroup}
  Subject: {varEmailSubject}
  Body: {varEmailBody}

[End For Each Loop]
```

**ACTION 6: Update Case - Mark Feedback Request Sent**
```
Action: Update Item
Update: Current Item
Fields:
  - Feedback Request Sent = Yes
```

**ACTION 7: Log Completion**
```
Action: Log to History List
Message: Feedback requests sent for Case {varCaseID} to {varScreeningMembers:Count} screening members and intake team.
```

---

### 5.3 Workflow 3: Feedback Manager

**Workflow Name:** Feedback Manager  
**Start Event:** Item Created OR Item Modified (Feedback Submissions list)  
**Run as:** Workflow owner  
**State:** Enabled

#### 5.3.1 Workflow Variables

| Variable Name | Type | Default Value |
|---------------|------|---------------|
| varCaseID | Single line of text | (empty) |
| varScreeningMember | Person | (empty) |
| varSupervisor | Person | (empty) |
| varIntakeContact | Person | (empty) |
| varCaseItemID | Number | 0 |
| varFeedbackCount | Number | 0 |
| varExpectedCount | Number | 0 |
| varAllReceived | Boolean | No |
| varSubmissionStatus | Single line of text | (empty) |
| varFeedbackItemID | Number | 0 |

#### 5.3.2 Workflow Actions (Step-by-Step)

**ACTION 1: Store Current Feedback Item Values**
```
Action: Set Variable
varCaseID = [Current Item:Case ID] (lookup value)
varScreeningMember = [Current Item:Screening Team Member]
varSupervisor = [Current Item:Supervisor]
varIntakeContact = [Current Item:Case ID:Intake Service Team Contact] (lookup)
varSubmissionStatus = [Current Item:Submission Status]
varFeedbackItemID = [Current Item:ID]
```

**ACTION 2: Break Inheritance on Feedback Item (if new item)**
```
Action: Run If
Condition: [Workflow Context:Event] equals "Item Added"
  Then:
    ACTION 2a: Call Web Service - Break Inheritance
    Web service URL: {Common:Site URL}/_vti_bin/Lists.asmx
    Method: UpdateListItems
    List: Feedback Submissions
    Request:
    <Batch OnError="Continue">
      <Method ID="1" Cmd="Update">
        <Field Name='ID'>{varFeedbackItemID}</Field>
        <Field Name='PermMask'>BreakRoleInheritance</Field>
      </Method>
    </Batch>

    ACTION 2b: Grant Permissions - Administrators
    [Use Call Web Service - Permissions.asmx]
    - CRW Administrators → FullMask

    ACTION 2c: Grant Permissions - Workgroup
    - CRW Workgroup → EditListItems

    ACTION 2d: Grant Permissions - Screening Member (Creator)
    - {varScreeningMember} → EditListItems

    ACTION 2e: Grant Permissions - Supervisor
    - {varSupervisor} → ViewListItems

    ACTION 2f: Grant Permissions - Intake Contact
    - {varIntakeContact} → ViewListItems
```

**ACTION 3: Update Feedback Count (if Status = Submitted)**
```
Action: Run If
Condition: varSubmissionStatus equals "Submitted"
  Then:
    ACTION 3a: Query Feedback Submissions Count
    Action: Query List
    List: Feedback Submissions
    CAML:
    <Where>
      <And>
        <Eq><FieldRef Name='Case_x0020_ID'/><Value Type='Lookup'>{varCaseID}</Value></Eq>
        <Eq><FieldRef Name='Submission_x0020_Status'/><Value Type='Choice'>Submitted</Value></Eq>
      </And>
    </Where>
    Store count in: varFeedbackCount

    ACTION 3b: Find Parent Case Item
    Action: Query List
    List: Case Review
    CAML:
    <Where>
      <Eq><FieldRef Name='Case_x0020_ID'/><Value Type='Text'>{varCaseID}</Value></Eq>
    </Where>
    Store first item ID in: varCaseItemID

    ACTION 3c: Get Expected Count from Case
    Action: Query List
    List: Case Review
    Filter: ID equals {varCaseItemID}
    Store {Item:Expected Feedback Count} in: varExpectedCount

    ACTION 3d: Update Case Feedback Count
    Action: Update Item
    List: Case Review
    Item ID: varCaseItemID
    Fields:
      - Feedback Count = {varFeedbackCount}

    ACTION 3e: Check if All Feedback Received
    Action: Run If
    Condition: varFeedbackCount equals varExpectedCount
      Then:
        Action: Update Item
        List: Case Review
        Item ID: varCaseItemID
        Fields:
          - All Feedback Received = Yes
          - Case Status = Feedback Received
      
      Action: Log to History List
      Message: All feedback received for Case {varCaseID}. Count: {varFeedbackCount}/{varExpectedCount}
```

**ACTION 4: Handle Additional Feedback Request**
```
Action: Run If
Condition: [Current Item:Additional Feedback Requested] equals Yes AND [Workflow Context:Event] equals "Item Changed"
  Then:
    ACTION 4a: Get Additional Feedback Request Template
    Action: Query List
    List: Email Templates
    Filter: Template Type equals "Additional Feedback Request" AND Active equals Yes
    Store first item in: varTemplateItem

    ACTION 4b: Build Email
    [Set varEmailSubject and varEmailBody from template]
    
    ACTION 4c: Replace Tokens
    - \[CaseID\] → {varCaseID}
    - \[CaseName\] → [Current Item:Case ID:Case Name]
    - \[ScreeningMember\] → {varScreeningMember:Display Name}
    - \[FeedbackContent\] → [Current Item:Additional Feedback Text]
    
    ACTION 4d: Build Edit Link
    Action: Build String
    Pattern: {Common:Site URL}/Lists/Feedback Submissions/EditForm.aspx?ID={varFeedbackItemID}&Source={Common:Site URL}/SitePages/FeedbackDashboard.aspx
    Store in: varFeedbackLink

    ACTION 4e: Replace FeedbackLink Token
    [Replace \[FeedbackLink\] in body]

    ACTION 4f: Send Email
    Action: Send Email
    To: {varScreeningMember}
    CC: {varSupervisor}
    Subject: {varEmailSubject}
    Body: {varEmailBody}

    ACTION 4g: Update Additional Feedback Date
    Action: Update Item
    Update: Current Item
    Fields:
      - Additional Feedback Date = [Workflow Context:Current Date]
```

**ACTION 5: Log Completion**
```
Action: Log to History List
Message: Feedback Manager completed for Case {varCaseID}, Screening Member: {varScreeningMember:Display Name}, Status: {varSubmissionStatus}
```

---

### 5.4 Workflow 4: Compile and Distribute Feedback

**Workflow Name:** Compile and Distribute Feedback  
**Start Event:** Item Modified (Case Review list)  
**Start Condition:** All Feedback Received equals "Yes"  
**Run as:** Workflow owner  
**State:** Enabled

#### 5.4.1 Workflow Variables

| Variable Name | Type | Default Value |
|---------------|------|---------------|
| varCaseID | Single line of text | (empty) |
| varCaseName | Single line of text | (empty) |
| varScreeningMembers | Person (collection) | (empty) |
| varCurrentScreeningMember | Person | (empty) |
| varSupervisor | Person | (empty) |
| varFeedbackItems | Collection | (empty) |
| varCurrentFeedbackItem | Object | (empty) |
| varCompiledFeedback | Multiple lines | (empty) |
| varFeedbackDocumentURL | Hyperlink | (empty) |
| varFeedbackDocumentName | Single line of text | (empty) |
| varEmailSubject | Multiple lines | (empty) |
| varEmailBody | Multiple lines | (empty) |
| varFolderName | Single line of text | (empty) |
| varDocLibURL | Single line of text | (empty) |
| varFeedbackHTMLContent | Multiple lines | (empty) |

#### 5.4.2 Workflow Actions (Step-by-Step)

**ACTION 1: Store Case Values**
```
Action: Set Variable
varCaseID = [Current Item:Case ID]
varCaseName = [Current Item:Case Name]
varScreeningMembers = [Current Item:Screening Team Members]
varSupervisor = [Current Item:Supervisor]
varFolderName = [Current Item:Folder Name]
```

**ACTION 2: Loop Through Each Screening Team Member**
```
Action: For Each
Collection: varScreeningMembers
Store current item in: varCurrentScreeningMember

  ACTION 2a: Query This Member's Feedback
  Action: Query List
  List: Feedback Submissions
  CAML:
  <Where>
    <And>
      <Eq><FieldRef Name='Case_x0020_ID'/><Value Type='Lookup'>{varCaseID}</Value></Eq>
      <Eq><FieldRef Name='Screening_x0020_Team_x0020_Member'/><Value Type='Integer'><UserID Type='User'>{varCurrentScreeningMember}</UserID></Value></Eq>
    </And>
  </Where>
  Store result collection in: varFeedbackItems

  ACTION 2b: Build Compiled Feedback for This Member
  Action: Set Variable
  varCompiledFeedback = (empty - reset for each member)

  Action: For Each (nested loop)
  Collection: varFeedbackItems
  Store current item in: varCurrentFeedbackItem
  
    Action: Build String
    Pattern: {varCompiledFeedback}<br/><br/><strong>Submission Date:</strong> {varCurrentFeedbackItem:Date Submitted}<br/><strong>Feedback:</strong><br/>{varCurrentFeedbackItem:Feedback Text}
    Store in: varCompiledFeedback
  
  [End nested For Each]

  ACTION 2c: Create HTML Document for This Member
  Action: Build String
  Pattern (full HTML):
  <!DOCTYPE html>
  <html>
  <head>
    <title>Case Review Feedback - {varCaseID}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      h1 { color: #003366; }
      .header { background-color: #f0f0f0; padding: 10px; margin-bottom: 20px; }
      .content { margin: 20px 0; }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>Case Review Feedback Summary</h1>
      <p><strong>Case ID:</strong> {varCaseID}</p>
      <p><strong>Case Name:</strong> {varCaseName}</p>
      <p><strong>Screening Team Member:</strong> {varCurrentScreeningMember:Display Name}</p>
      <p><strong>Supervisor:</strong> {varSupervisor:Display Name}</p>
      <p><strong>Compiled Date:</strong> {Workflow Context:Current Date}</p>
    </div>
    <div class="content">
      <h2>Your Feedback</h2>
      {varCompiledFeedback}
    </div>
  </body>
  </html>
  Store in: varFeedbackHTMLContent

  ACTION 2d: Build Document Name
  Action: Build String
  Pattern: Feedback_{varCaseID}_{varCurrentScreeningMember:Login Name}.html
  Store in: varFeedbackDocumentName

  ACTION 2e: Create Document in Case Folder
  Action: Create Item
  List: Case Documents
  Path: {varFolderName}
  Content Type: Document
  Fields:
    - Name = {varFeedbackDocumentName}
    - Case ID = {varCaseID}
    - Document Type = Compiled Feedback
  
  [Note: For actual file upload with content, use REST API call]

  ACTION 2f: Upload HTML Content via REST (critical for automation)
  Action: Call HTTP Web Service
  URL: {Common:Site URL}/_api/web/GetFolderByServerRelativeUrl('/Case Documents/{varFolderName}')/Files/add(url='{varFeedbackDocumentName}',overwrite=true)
  Method: POST
  Headers:
    - Accept: application/json;odata=verbose
    - Content-Type: text/html
  Body: {varFeedbackHTMLContent}
  Store response in: varDocUploadResponse

  ACTION 2g: Get Document URL
  Action: Build String
  Pattern: {Common:Site URL}/Case Documents/{varFolderName}/{varFeedbackDocumentName}
  Store in: varFeedbackDocumentURL

  ACTION 2h: Update Feedback Submission with Document Link
  Action: Query List
  List: Feedback Submissions
  CAML:
  <Where>
    <And>
      <Eq><FieldRef Name='Case_x0020_ID'/><Value Type='Lookup'>{varCaseID}</Value></Eq>
      <Eq><FieldRef Name='Screening_x0020_Team_x0020_Member'/><Value Type='Integer'><UserID Type='User'>{varCurrentScreeningMember}</UserID></Value></Eq>
    </And>
  </Where>
  Store first item ID in: varFeedbackItemID

  Action: Update Item
  List: Feedback Submissions
  Item ID: varFeedbackItemID
  Fields:
    - Feedback Document = {varFeedbackDocumentURL}, View Feedback
    - Submission Status = Compiled

  ACTION 2i: Send Individual Feedback Email
  Action: Query List
  List: Email Templates
  Filter: Template Type equals "Individual Feedback Delivery" AND Active equals Yes
  Store first item in: varTemplateItem

  Action: Set Variable
  varEmailSubject = {varTemplateItem:Email Subject}
  varEmailBody = {varTemplateItem:Email Body}

  ACTION 2j: Replace Tokens in Email
  [Replace in both Subject and Body:]
  - \[CaseID\] → {varCaseID}
  - \[CaseName\] → {varCaseName}
  - \[ScreeningMember\] → {varCurrentScreeningMember:Display Name}
  - \[Supervisor\] → {varSupervisor:Display Name}
  - \[FeedbackContent\] → {varCompiledFeedback}
  - \[FeedbackLink\] → {varFeedbackDocumentURL}

  ACTION 2k: Send Email to Screening Member
  Action: Send Email
  To: {varCurrentScreeningMember}
  CC: {varSupervisor}
  Subject: {varEmailSubject}
  Body: {varEmailBody}

  ACTION 2l: Update Feedback Submission Status
  Action: Update Item
  List: Feedback Submissions
  Item ID: varFeedbackItemID
  Fields:
    - Submission Status = Sent to Member

[End For Each - Screening Members Loop]
```

**ACTION 3: Update Case Status**
```
Action: Update Item
Update: Current Item
Fields:
  - Case Status = Feedback Sent
  - Feedback Compiled Date = [Workflow Context:Current Date]
```

**ACTION 4: Log Completion**
```
Action: Log to History List
Message: Feedback compiled and distributed for Case {varCaseID} to {varScreeningMembers:Count} screening members.
```

---

### 5.5 (OPTIONAL) Workflow 5: Feedback Reminder

**Workflow Name:** Feedback Reminder  
**Start Event:** Scheduled (Daily at 8:00 AM)  
**Run on:** Case Review list  
**Run as:** Workflow owner  
**State:** Enabled

#### 5.5.1 Workflow Variables

| Variable Name | Type | Default Value |
|---------------|------|---------------|
| varCurrentDate | Date | (empty) |
| varReminderDate | Date | (empty) |
| varCaseItems | Collection | (empty) |
| varCurrentCase | Object | (empty) |
| varCaseID | Single line of text | (empty) |
| varScreeningMembers | Person (collection) | (empty) |
| varCurrentScreeningMember | Person | (empty) |
| varMissingFeedback | Person (collection) | (empty) |
| varEmailSubject | Multiple lines | (empty) |
| varEmailBody | Multiple lines | (empty) |

#### 5.5.2 Workflow Actions (Step-by-Step)

**ACTION 1: Calculate Reminder Date (2 days before meeting)**
```
Action: Set Variable
varCurrentDate = [Workflow Context:Current Date]

Action: Calculate Date
Date: varCurrentDate
Add: 2 (days)
Store in: varReminderDate
```

**ACTION 2: Query Cases Needing Reminders**
```
Action: Query List
List: Case Review
CAML:
<Where>
  <And>
    <And>
      <Eq><FieldRef Name='Case_x0020_Status'/><Value Type='Choice'>Awaiting Feedback</Value></Eq>
      <Eq><FieldRef Name='Review_x0020_Meeting_x0020_Date'/><Value Type='DateTime'>{varReminderDate}</Value></Eq>
    </And>
    <Eq><FieldRef Name='All_x0020_Feedback_x0020_Received'/><Value Type='Boolean'>0</Value></Eq>
  </And>
</Where>
Store result collection in: varCaseItems
```

**ACTION 3: Loop Through Cases**
```
Action: For Each
Collection: varCaseItems
Store current item in: varCurrentCase

  ACTION 3a: Get Case Details
  Action: Set Variable
  varCaseID = {varCurrentCase:Case ID}
  varScreeningMembers = {varCurrentCase:Screening Team Members}

  ACTION 3b: Find Members Who Haven't Submitted
  Action: Set Variable
  varMissingFeedback = (empty collection)

  Action: For Each (nested)
  Collection: varScreeningMembers
  Store current item in: varCurrentScreeningMember

    ACTION 3b-i: Check if This Member Submitted
    Action: Query List
    List: Feedback Submissions
    CAML:
    <Where>
      <And>
        <Eq><FieldRef Name='Case_x0020_ID'/><Value Type='Lookup'>{varCaseID}</Value></Eq>
        <And>
          <Eq><FieldRef Name='Screening_x0020_Team_x0020_Member'/><Value Type='Integer'><UserID Type='User'>{varCurrentScreeningMember}</UserID></Value></Eq>
          <Eq><FieldRef Name='Submission_x0020_Status'/><Value Type='Choice'>Submitted</Value></Eq>
        </And>
      </And>
    </Where>
    Store count in: varSubmissionCount

    ACTION 3b-ii: Add to Missing List if Not Submitted
    Action: Run If
    Condition: varSubmissionCount equals 0
      Then:
        Action: Collection Operation
        Operation: Add
        Collection: varMissingFeedback
        Item: {varCurrentScreeningMember}

  [End nested For Each]

  ACTION 3c: Send Reminders to Missing Members
  Action: For Each (nested)
  Collection: varMissingFeedback
  Store current item in: varCurrentScreeningMember

    ACTION 3c-i: Get Reminder Template
    Action: Query List
    List: Email Templates
    Filter: Template Type equals "Feedback Reminder" AND Active equals Yes
    Store first item in: varTemplateItem

    ACTION 3c-ii: Build Email
    [Set varEmailSubject and varEmailBody from template]

    ACTION 3c-iii: Replace Tokens
    - \[CaseID\] → {varCaseID}
    - \[CaseName\] → {varCurrentCase:Case Name}
    - \[ScreeningMember\] → {varCurrentScreeningMember:Display Name}
    - \[ReviewMeetingDate\] → {varCurrentCase:Review Meeting Date}
    - \[FeedbackLink\] → {Common:Site URL}/Lists/Feedback Submissions/NewForm.aspx?Case_x0020_ID={varCaseID}

    ACTION 3c-iv: Send Reminder Email
    Action: Send Email
    To: {varCurrentScreeningMember}
    CC: {varCurrentCase:Supervisor}
    Subject: {varEmailSubject}
    Body: {varEmailBody}

  [End nested For Each - Missing Feedback]

[End For Each - Cases]
```

**ACTION 4: Log Completion**
```
Action: Log to History List
Message: Reminder workflow completed. Reminders sent for {varCaseItems:Count} cases.
```

---

## 6. FEEDBACK DASHBOARD PAGE

### 6.1 Create FeedbackDashboard.aspx Page

**Navigation:** Site Settings → Site Contents → Site Pages → New → Web Part Page

**Configuration:**
- Page Name: FeedbackDashboard.aspx
- Layout: Header, Footer, 2 Columns, 4 Rows
- Document Library: Site Pages

### 6.2 Page Layout and Web Parts

#### Zone 1: Header (Full Width)
**Web Part:** Content Editor Web Part

**Content:**
```html
<div style="background-color: #003366; color: white; padding: 20px; margin-bottom: 20px;">
  <h1>Case Review Feedback Dashboard</h1>
  <p>View and manage your case review feedback submissions in this secure environment.</p>
</div>
```

#### Zone 2: Left Column - My Assigned Cases
**Web Part:** List View Web Part - Case Review (Custom View)

**View Settings:**
- View Name: My Assigned Cases
- Columns to Display:
  - Case ID
  - Case Name
  - Case Status
  - Review Meeting Date
  - Feedback Count
  - Expected Feedback Count
- Filter:
  - Screening Team Members equals [Me]
- Sort: Date Identified (descending)

**Edit Web Part Properties:**
- Chrome Type: Default
- Title: My Assigned Cases
- Toolbar Type: Summary Toolbar

#### Zone 3: Left Column - Quick Actions
**Web Part:** Content Editor Web Part

**Content:**
```html
<div style="background-color: #f9f9f9; padding: 15px; border: 1px solid #ccc; margin-top: 20px;">
  <h3>Quick Actions</h3>
  <ul>
    <li><a href="/Lists/Feedback Submissions/NewForm.aspx?Source=/SitePages/FeedbackDashboard.aspx" target="_blank">Submit New Feedback</a></li>
    <li><a href="/Case Documents/Forms/AllItems.aspx" target="_blank">View Case Documents</a></li>
    <li><a href="/Lists/Case Review/AllItems.aspx?View={My Cases View GUID}" target="_blank">View All My Cases</a></li>
  </ul>
</div>
```

#### Zone 4: Right Column - My Feedback Submissions
**Web Part:** List View Web Part - Feedback Submissions (Custom View)

**View Settings:**
- View Name: My Feedback Dashboard
- Columns to Display:
  - Case ID
  - Case Name (lookup)
  - Submission Status
  - Date Submitted
  - Feedback Document (as link)
  - Additional Feedback Requested
- Filter:
  - Screening Team Member equals [Me] OR Created By equals [Me]
- Sort: Date Submitted (descending)

**Edit Web Part Properties:**
- Chrome Type: Default
- Title: My Feedback Submissions
- Toolbar Type: Summary Toolbar

#### Zone 5: Right Column - Pending Items
**Web Part:** List View Web Part - Feedback Submissions (Custom View)

**View Settings:**
- View Name: My Pending Feedback
- Columns to Display:
  - Case ID
  - Case Name (lookup)
  - Submission Status
  - Additional Feedback Requested
  - Edit (link to EditForm)
- Filter:
  - (Screening Team Member equals [Me] OR Created By equals [Me])
  - AND (Submission Status equals "Draft" OR Additional Feedback Requested equals "Yes")
- Sort: Case ID

**Edit Web Part Properties:**
- Chrome Type: Default
- Title: Action Required
- Toolbar Type: Summary Toolbar

#### Zone 6: Footer (Full Width)
**Web Part:** Content Editor Web Part

**Content:**
```html
<div style="background-color: #f0f0f0; padding: 10px; margin-top: 20px; text-align: center; font-size: 12px;">
  <p><strong>Secure Environment Notice:</strong> This is a confidential case review system. You can only view feedback and cases you are assigned to. All activity is logged.</p>
  <p>For assistance, contact the Case Review Workgroup.</p>
</div>
```

### 6.3 Page Permissions

**Break inheritance on FeedbackDashboard.aspx:**
```
Permissions:
- CRW Administrators: Full Control
- CRW Workgroup: Edit
- CRW Screening Team: Read
- CRW Supervisors: Read
- CRW Service Teams: Read
- CRW Intake Team: Read
```

### 6.4 Add to Navigation

**Steps:**
1. Site Settings → Navigation
2. Current Navigation → Add Link
   - Title: Feedback Dashboard
   - URL: /SitePages/FeedbackDashboard.aspx
   - Audience: CRW Screening Team, CRW Supervisors, CRW Workgroup
3. Save

---

## 7. DOCUMENT AUTOMATION

### 7.1 REST API Integration for Document Upload

The Compile and Distribute Feedback workflow uses REST API to automate document creation. Here's the detailed implementation:

#### 7.1.1 REST API Call Configuration (in Nintex)

**Action:** Call HTTP Web Service

**Web Service URL:**
```
{Common:Site URL}/_api/web/GetFolderByServerRelativeUrl('/Case Documents/{varFolderName}')/Files/add(url='{varFeedbackDocumentName}',overwrite=true)
```

**HTTP Method:** POST

**Headers:**
```
Accept: application/json;odata=verbose
Content-Type: text/html; charset=utf-8
X-RequestDigest: {form digest value}
```

**Request Body:**
```
{varFeedbackHTMLContent}
```

**Authentication:**
- Use current user credentials or service account with Full Control

**Response Storage:**
- Store response in variable: varDocUploadResponse

#### 7.1.2 Alternative: PDF Generation (if required)

If PDF output is required instead of HTML, use this approach:

**Option A: Server-Side Conversion**
```
1. Create HTML document as described above
2. Call HTTP Web Service to PDF conversion service
3. Upload resulting PDF to library
```

**Option B: Word Document (DOCX) Generation**
```
1. Create Word template with bookmarks:
   - CaseID
   - CaseName
   - ScreeningMember
   - Supervisor
   - CompiledDate
   - FeedbackContent

2. In workflow:
   - Call HTTP Web Service to Word automation service
   - Pass bookmark values
   - Receive populated DOCX
   - Upload to Case Documents library
```

### 7.2 Automatic Hyperlink Population

**In Workflow 4 (Compile and Distribute Feedback), ACTION 2h:**

```
Action: Update Item
List: Feedback Submissions
Item ID: varFeedbackItemID
Fields:
  - Feedback Document = {varFeedbackDocumentURL}, View Feedback

Note: The field value format for hyperlink is: URL, Description
Example: https://site/doc.html, View Feedback
```

### 7.3 Document Permissions

Documents inherit folder permissions set in Workflow 1 (Case Initialization), ensuring:
- Screening Team Member: Can view their own feedback documents
- Supervisor: Can view supervised members' feedback documents
- Workgroup: Can view all feedback documents
- Others: No access

---

## 8. TESTING PROCEDURES

### 8.1 Pre-Testing Checklist

- [ ] All 4 lists/libraries created with exact column names
- [ ] All 6 email templates created with exact content
- [ ] All SharePoint groups created and populated
- [ ] All list/library permissions broken and configured
- [ ] All 4 workflows created and published
- [ ] Feedback Dashboard page created and configured
- [ ] Test user accounts created in each role

### 8.2 Test Scenarios

#### Test 1: End-to-End Workgroup Selection
**Objective:** Verify complete workflow from case creation to feedback distribution

**Steps:**
1. **Create Case (as Workgroup member):**
   - Navigate to Case Review list
   - New Item
   - Fill all required fields:
     - Case ID: TEST-001
     - Case Name: Test Case - Workgroup Selection
     - Source: Workgroup Selection
     - Assigned Workgroup: [Select 2-3 members]
     - Screening Team Members: [Select 2 members]
     - Intake Service Team Contact: [Select 1 member]
     - Supervisor: [Select 1 supervisor]
     - Review Meeting Date: [Today + 7 days]
   - Save

2. **Verify Workflow 1 (Case Initialization):**
   - [ ] Case Status changed to "Documents Uploaded"
   - [ ] Folder created: Case_TEST-001
   - [ ] Documents Link populated
   - [ ] Expected Feedback Count = 2
   - [ ] Email received by Assigned Workgroup members
   - [ ] Verify item permissions (only assigned users can view)
   - [ ] Verify folder permissions (only assigned users can access)

3. **Upload Documents (as Workgroup member):**
   - Navigate to Case Documents/Case_TEST-001
   - Upload sample documents:
     - AI Report.pdf
     - Safety Assessment.docx
     - Activity Logs.xlsx
   - Set Document Type for each

4. **Request Feedback (as Workgroup member):**
   - Edit Case TEST-001
   - Change Case Status to "Awaiting Feedback"
   - Save

5. **Verify Workflow 2 (Request Feedback):**
   - [ ] Emails sent to Intake Service Team Contact
   - [ ] Emails sent to each Screening Team Member (2 emails)
   - [ ] Each email contains correct [ScreeningMember] and [Supervisor]
   - [ ] FeedbackLink directs to NewForm with Case ID pre-filled
   - [ ] Feedback Request Sent flag = Yes

6. **Submit Feedback (as Screening Team Member 1):**
   - Log in as Screening Team Member
   - Access Feedback Dashboard
   - Verify only Case TEST-001 visible in "My Assigned Cases"
   - Click "Submit New Feedback" or link from email
   - Fill form:
     - Case ID: TEST-001 (from lookup or pre-filled)
     - Screening Team Member: [Auto-filled or select self]
     - Supervisor: [Select supervisor]
     - Feedback Text: "Sample feedback from member 1..."
     - Submission Status: Submitted
     - Date Submitted: [Today]
   - Save

7. **Verify Workflow 3 (Feedback Manager) - First Submission:**
   - [ ] Feedback Submissions item permissions set correctly
   - [ ] Only creator, supervisor, and workgroup can view
   - [ ] Case Review Feedback Count = 1
   - [ ] All Feedback Received = No

8. **Submit Feedback (as Screening Team Member 2):**
   - Repeat step 6 with second member
   - Fill feedback with different content

9. **Verify Workflow 3 (Feedback Manager) - Final Submission:**
   - [ ] Case Review Feedback Count = 2
   - [ ] All Feedback Received = Yes
   - [ ] Case Status changed to "Feedback Received"

10. **Verify Workflow 4 (Compile and Distribute Feedback) - Auto-triggered:**
    - [ ] Wait 1-2 minutes for workflow to complete
    - [ ] Check Case Documents/Case_TEST-001 for compiled feedback files:
      - Feedback_TEST-001_[Member1Login].html
      - Feedback_TEST-001_[Member2Login].html
    - [ ] Each file Document Type = "Compiled Feedback"
    - [ ] Verify HTML content contains correct case info and feedback
    - [ ] Verify Feedback Submissions items updated:
      - Feedback Document hyperlink populated
      - Submission Status = "Sent to Member"
    - [ ] Verify emails sent to both Screening Team Members
    - [ ] Each email CC'd to Supervisor
    - [ ] Email contains compiled feedback and document link
    - [ ] Case Status = "Feedback Sent"
    - [ ] Feedback Compiled Date populated

11. **Test Permissions (as unauthorized user):**
    - Log in as user NOT assigned to case
    - Navigate to Case Review
    - [ ] Case TEST-001 NOT visible
    - Navigate to Case Documents
    - [ ] Folder Case_TEST-001 NOT visible or accessible
    - Navigate to Feedback Submissions
    - [ ] No feedback items for TEST-001 visible

#### Test 2: Service Team Referral
**Objective:** Verify Service Team can access and edit their case

**Steps:**
1. **Create Case (as Service Team member):**
   - Login as member of CRW Service Teams group
   - Create case with Source: "Service Team Referral"
   - Save

2. **Verify Permissions:**
   - [ ] Service Team member (creator) has Contribute on case item
   - [ ] Service Team member can edit case
   - [ ] Service Team member can upload to case folder
   - [ ] Service Team member receives assignment email

3. **Test Edit Access:**
   - Service Team member edits case
   - Adds Review Meeting Notes
   - [ ] Save successful

#### Test 3: Additional Feedback Request
**Objective:** Verify workgroup can request additional info from screening members

**Steps:**
1. **Request Additional Feedback (as Workgroup member):**
   - Navigate to Feedback Submissions
   - Find submission for TEST-001, Member 1
   - Edit item:
     - Additional Feedback Requested: Yes
     - Additional Feedback Text: "Please clarify your assessment of the safety plan effectiveness."
   - Save

2. **Verify Workflow 3 (Additional Request Handling):**
   - [ ] Email sent to Screening Team Member 1
   - [ ] Email CC'd to Supervisor
   - [ ] Email contains FeedbackLink to EditForm (not NewForm)
   - [ ] Additional Feedback Date populated

3. **Submit Additional Feedback (as Screening Team Member 1):**
   - Click link from email
   - Append to Feedback Text: "\n\nAdditional clarification: The safety plan..."
   - Additional Feedback Requested: No (optional)
   - Save

4. **Verify Update:**
   - [ ] Feedback text updated (not new item created)
   - [ ] Can re-compile feedback if needed

#### Test 4: Feedback Dashboard
**Objective:** Verify dashboard shows correct filtered data

**Steps:**
1. **Login as Screening Team Member:**
   - Navigate to Feedback Dashboard
   - [ ] "My Assigned Cases" shows only cases where member is in Screening Team Members
   - [ ] "My Feedback Submissions" shows only member's submissions
   - [ ] "Action Required" shows drafts and additional feedback requests

2. **Login as Supervisor:**
   - Navigate to Feedback Dashboard
   - [ ] Can see supervised members' cases (if filter configured)
   - [ ] Cannot see other supervisors' cases

3. **Login as Workgroup member:**
   - Navigate to Feedback Dashboard
   - [ ] Can see all cases
   - [ ] Can see all feedback submissions

#### Test 5: Reminder Workflow (if implemented)
**Objective:** Verify reminders sent for overdue feedback

**Steps:**
1. **Create Case with Near-Future Meeting Date:**
   - Case ID: TEST-REM-001
   - Review Meeting Date: [Today + 2 days]
   - Request Feedback (Status = Awaiting Feedback)

2. **Wait for Scheduled Workflow Run (or manually start):**
   - Workflow should run daily at 8 AM
   - Or manually start workflow for testing

3. **Verify Reminders:**
   - [ ] Reminder emails sent only to members who haven't submitted
   - [ ] No reminder sent to members who already submitted

### 8.3 Performance Testing

**Test Scenario: Multiple Concurrent Cases**
1. Create 10 cases simultaneously
2. Monitor workflow execution
3. Verify:
   - [ ] All workflows complete successfully
   - [ ] No duplicate emails sent
   - [ ] Permissions set correctly on all items
   - [ ] No timeout errors

**Test Scenario: Large Screening Team**
1. Create case with 10 screening team members
2. Expected Feedback Count = 10
3. Submit all 10 feedbacks
4. Verify:
   - [ ] All 10 compiled documents created
   - [ ] All 10 individual emails sent
   - [ ] Workflow completes in reasonable time (<5 minutes)

### 8.4 Edge Case Testing

**Edge Case 1: Duplicate Case ID**
- Attempt to create case with existing Case ID
- [ ] Validation prevents creation (unique constraint)

**Edge Case 2: Missing Required Fields**
- Attempt to save case without Supervisor
- [ ] Validation prevents save

**Edge Case 3: Workflow Interruption**
- Pause workflow during execution
- [ ] Workflow Run Flag prevents duplicate start
- [ ] Resume completes successfully

**Edge Case 4: Email Template Missing**
- Deactivate email template (Active = No)
- Trigger workflow
- [ ] Workflow handles gracefully (error logging)
- [ ] Doesn't send email with missing template

---

## 9. TROUBLESHOOTING GUIDE

### 9.1 Common Issues and Solutions

#### Issue 1: Workflow Not Starting
**Symptoms:** Workflow doesn't run when item created/modified

**Diagnosis:**
```
1. Check Workflow Status:
   - List Settings → Workflow Settings
   - Click workflow name
   - Verify Status: Enabled (not Disabled)

2. Check Permissions:
   - Verify workflow service account has Full Control on list
   - Site Settings → Site Permissions → Check User Permissions
   - Enter workflow service account name

3. Check Start Conditions:
   - Workflow Settings → Start Options
   - Verify correct triggers selected (Item Created, Item Modified)
   - Verify Start Condition matches (e.g., Case Status = Awaiting Feedback)
```

**Solution:**
```
- If disabled, re-publish workflow
- If permissions missing, grant Full Control to service account
- If condition not met, verify column values match exactly
```

#### Issue 2: Emails Not Sending
**Symptoms:** Workflow runs but no emails received

**Diagnosis:**
```
1. Check Workflow History:
   - List item → Workflows → [Workflow Name] → View workflow history
   - Look for errors in Send Email actions

2. Check Email Template:
   - Verify template exists in Email Templates list
   - Verify Active = Yes
   - Verify Template Type matches query in workflow

3. Check Recipient:
   - Verify person field contains valid email address
   - Check spam/junk folders
```

**Solution:**
```
- If email action failed, check error message
- If template not found, create or activate template
- If recipient invalid, update person field with valid user
- Configure outbound email (Central Admin → System Settings → Outbound Email)
```

#### Issue 3: Permissions Not Set Correctly
**Symptoms:** Users see items they shouldn't or can't access assigned items

**Diagnosis:**
```
1. Check Item Permissions:
   - List item → ... → Shared With
   - Verify inheritance broken (should show "Limited Access")
   - Verify correct groups/users have correct permission levels

2. Check Workflow Execution:
   - Workflow history for permission-setting actions
   - Look for "Access Denied" or "Insufficient permissions" errors

3. Check Service Account:
   - Verify workflow service account has Full Control on list
```

**Solution:**
```
- If inheritance not broken:
  1. Edit item
  2. ... → Shared With → Advanced
  3. Stop Inheriting Permissions
  4. Remove inherited groups
  5. Add correct groups manually
  6. Re-run workflow

- If workflow errors:
  1. Grant Full Control to workflow service account
  2. Re-save item to trigger workflow

- If groups wrong:
  1. Verify SharePoint groups exist
  2. Verify users are members
  3. Update workflow to use correct group names
```

#### Issue 4: Folder Not Created
**Symptoms:** Case folder doesn't appear in Case Documents library

**Diagnosis:**
```
1. Check Workflow History:
   - Look for Create Item action for folder
   - Check for errors

2. Check Library Settings:
   - Library Settings → Advanced Settings
   - Verify "Make New Folder command available" = Yes

3. Check Folder Name:
   - Verify Folder Name calculated column working
   - Check for invalid characters in Case ID
```

**Solution:**
```
- If folder creation failed:
  1. Enable folders in library settings
  2. Re-run workflow (re-save case item)

- If invalid characters:
  1. Edit Case ID to remove: / \ : * ? " < > |
  2. Re-save

- Manual workaround:
  1. Manually create folder with name Case_[CaseID]
  2. Build Documents Link manually
  3. Update case item
```

#### Issue 5: Feedback Count Not Updating
**Symptoms:** Feedback Count stays at 0 even after submissions

**Diagnosis:**
```
1. Check Feedback Manager Workflow:
   - Check if workflow running on Feedback Submissions list
   - View workflow history for last submission

2. Check Submission Status:
   - Verify feedback item has Submission Status = "Submitted"
   - Workflow only counts "Submitted" status

3. Check Case ID Lookup:
   - Verify lookup field connecting Feedback to Case
   - Check Case ID value matches exactly
```

**Solution:**
```
- If workflow not running:
  1. Check workflow enabled
  2. Verify triggers (Item Created, Item Modified)
  3. Re-publish workflow

- If status wrong:
  1. Edit feedback submission
  2. Change Submission Status to "Submitted"
  3. Save (triggers workflow)

- If lookup broken:
  1. Re-create lookup column
  2. Update existing items with correct Case ID
```

#### Issue 6: Token Replacement Not Working
**Symptoms:** Emails contain [CaseID] instead of actual case ID

**Diagnosis:**
```
1. Check Template:
   - Verify tokens use exact bracket format: [TokenName]
   - No spaces: [CaseID] not [ CaseID ]

2. Check Workflow:
   - Verify Regular Expression actions present
   - Check pattern uses escaped brackets: \[TokenName\]
   - Verify replacement variable contains value

3. Test Pattern:
   - In workflow, add Log to History after token replacement
   - Log the result: varEmailBody
   - Check actual output
```

**Solution:**
```
- If brackets wrong:
  1. Edit email template
  2. Fix token format to [TokenName]
  3. Re-trigger workflow

- If regex pattern wrong:
  1. Edit workflow
  2. Fix pattern to \[TokenName\] (escaped brackets)
  3. Test with single token first
  4. Publish workflow

- If variable empty:
  1. Add Set Variable action before regex
  2. Log variable value to history
  3. Verify variable stores correct value from current item
```

#### Issue 7: Document Upload Failing
**Symptoms:** Compiled feedback document not created in folder

**Diagnosis:**
```
1. Check Workflow History:
   - Look for Call HTTP Web Service action
   - Check response code (should be 200/201)

2. Check REST API URL:
   - Verify folder path correct
   - Verify document name valid (no special chars)

3. Check Content:
   - Verify varFeedbackHTMLContent contains valid HTML
   - Check for encoding issues
```

**Solution:**
```
- If REST call fails:
  1. Check service account has Full Control on library
  2. Verify URL format: _api/web/GetFolderByServerRelativeUrl...
  3. Check request headers include Accept and Content-Type

- If 404 error:
  1. Verify folder exists
  2. Check folder path is absolute: /Case Documents/{FolderName}

- Fallback approach:
  1. Create item in library with Name = {DocumentName}
  2. Manually upload HTML file to item
  3. Update Feedback Document hyperlink manually
```

#### Issue 8: Workflow Runs Multiple Times
**Symptoms:** Duplicate emails, multiple folders created

**Diagnosis:**
```
1. Check Workflow Run Flag:
   - Verify column "Workflow Run Flag" exists
   - Check workflow queries this flag first

2. Check Update Item Actions:
   - Ensure flag set to Yes immediately after check
   - Verify no other workflows updating same item
```

**Solution:**
```
- If flag missing:
  1. Add Yes/No column "Workflow Run Flag"
  2. Default value: No
  3. Hide from forms
  4. Update workflow to check and set flag

- If flag not set:
  1. Edit workflow
  2. Move Set Flag action to beginning (after check)
  3. Ensure it's not inside If/Else that might skip

- If multiple workflows:
  1. Review all workflows on list
  2. Disable conflicting workflows
  3. Consolidate logic into single workflow if possible
```

### 9.2 Diagnostic Queries

#### Query 1: Find Cases Missing Folders
```
Access Case Review list
Filter: Documents Link is empty
Result: Cases where folder creation failed
Action: Manually create folders and update links
```

#### Query 2: Find Orphaned Feedback (no matching case)
```
Access Feedback Submissions list
Create view with CAML:
<Where>
  <IsNull><FieldRef Name='Case_x0020_ID'/></IsNull>
</Where>
Result: Feedback items with broken lookup
Action: Fix lookup or delete orphaned items
```

#### Query 3: Find Cases with Incomplete Feedback
```
Access Case Review list
Filter: 
  - All Feedback Received = No
  - Case Status = Awaiting Feedback
  - Review Meeting Date < Today
Result: Overdue cases
Action: Send manual reminders or escalate
```

### 9.3 Emergency Procedures

#### Procedure 1: Reset Case Workflow
**When:** Workflow stuck or incomplete, need to start over

**Steps:**
```
1. Disable all workflows on Case Review list
2. Edit case item:
   - Workflow Run Flag = No
   - Feedback Request Sent = No
   - Case Status = New (or appropriate status)
3. Save
4. Enable workflows
5. Re-save item to trigger workflows
```

#### Procedure 2: Bulk Permission Reset
**When:** Permissions corrupted on multiple items

**Steps:**
```
1. Identify affected items (list IDs)
2. For each item:
   a. Navigate to item → ... → Shared With → Advanced
   b. Stop Inheriting Permissions (if not already)
   c. Remove all groups/users
   d. Add CRW Administrators with Full Control
3. Re-save each item to trigger workflows
4. Workflows will re-apply correct permissions
```

#### Procedure 3: Manual Feedback Compilation
**When:** Workflow 4 fails, need to distribute feedback manually

**Steps:**
```
1. Query Feedback Submissions for case
2. For each Screening Team Member:
   a. Copy feedback text to Word document
   b. Format document with case details
   c. Save as: Feedback_{CaseID}_{MemberName}.docx
   d. Upload to Case Documents/Case_{CaseID}
   e. Set Document Type = Compiled Feedback
3. Update Feedback Submissions:
   - Feedback Document = [URL to uploaded doc]
   - Submission Status = Compiled
4. Manually email each member with document link
5. Update case:
   - Case Status = Feedback Sent
   - Feedback Compiled Date = Today
```

### 9.4 Logging and Monitoring

#### Enable Verbose Workflow Logging
```
1. Workflow Settings → [Workflow Name]
2. Click workflow name to edit in Nintex Designer
3. Workflow Settings (gear icon)
4. Logging:
   - Log to workflow history list: Yes
   - Log each action: Yes (for debugging)
5. Publish

Note: Disable verbose logging after troubleshooting (performance)
```

#### Monitor Workflow Performance
```
1. Site Settings → Site Workflows
2. Workflow History (in Quick Launch if visible)
3. Create view:
   - Filter by workflow name
   - Group by Outcome (Completed, Error, Cancelled)
   - Sort by Logged (descending)
4. Review for patterns:
   - Frequent errors on specific action
   - Timeouts on specific list queries
   - Permission denied errors
```

#### Create Error Alert
```
1. Workflow History list → Alert Me
2. Send alert when:
   - Items are modified
   - Outcome contains "Error" or "Cancelled"
3. Send to: Workflow administrators
4. Frequency: Immediate
```

---

## 10. ADDITIONAL NOTES

### 10.1 Maintenance Tasks

**Weekly:**
- Review Workflow History for errors
- Check Email Templates list for unauthorized changes
- Verify all workflows enabled

**Monthly:**
- Review SharePoint group membership
- Audit permissions on sensitive lists
- Clean up completed cases (archive if retention policy)

**Quarterly:**
- Review and update email templates
- Test end-to-end workflow with new test case
- Update documentation for any process changes

### 10.2 Backup Recommendations

**Critical Components to Backup:**
1. Email Templates list (export to Excel)
2. Workflow definitions (.nwf files from Nintex Designer)
3. SharePoint group membership (export to CSV)
4. Site pages (FeedbackDashboard.aspx)

**Backup Procedure:**
```
1. Email Templates:
   - Export to Excel
   - Save to secure location
   - Version: Include date in filename

2. Workflows:
   - Nintex Designer → File → Export
   - Save .nwf file for each workflow
   - Store in SharePoint document library or file share

3. Groups:
   - Site Settings → People and Groups
   - For each group → Settings → List Settings → Export to Excel

4. Pages:
   - SharePoint Designer → Open Site
   - Site Pages → Export file
```

### 10.3 Scalability Considerations

**Current Configuration Limits:**
- Maximum 100 concurrent workflows (SharePoint throttling)
- Maximum 50 Screening Team Members per case (person field limit)
- Maximum 5000 items per list view (throttling)

**If Approaching Limits:**
1. **Workflows:**
   - Schedule workflows during off-peak hours
   - Implement queuing mechanism for large batches

2. **Person Fields:**
   - Consider splitting large teams into multiple cases
   - Use SharePoint groups instead of individual users

3. **List Views:**
   - Add indexed columns
   - Create filtered views (<5000 items)
   - Consider archiving old cases to separate list

### 10.4 Security Best Practices

1. **Regular Audits:**
   - Monthly review of SharePoint group membership
   - Quarterly permission audits on lists/libraries
   - Annual review of workflow service account permissions

2. **Access Reviews:**
   - Require managers to certify team membership quarterly
   - Remove users immediately upon role change or termination
   - Monitor workflow history for unauthorized access attempts

3. **Data Protection:**
   - Enable versioning to recover from accidental edits
   - Implement retention policy for completed cases
   - Encrypt backups of exported data

4. **Compliance:**
   - Log all access to sensitive feedback items
   - Maintain audit trail of workflow executions
   - Document any manual interventions

---

## APPENDIX A: CAML QUERY REFERENCE

### Commonly Used CAML Patterns

**Find Current Item:**
```xml
<Where>
  <Eq>
    <FieldRef Name='ID'/>
    <Value Type='Counter'>[Current Item:ID]</Value>
  </Eq>
</Where>
```

**Find by Case ID:**
```xml
<Where>
  <Eq>
    <FieldRef Name='Case_x0020_ID'/>
    <Value Type='Text'>{varCaseID}</Value>
  </Eq>
</Where>
```

**Find by Lookup (Feedback to Case):**
```xml
<Where>
  <Eq>
    <FieldRef Name='Case_x0020_ID' LookupId='FALSE'/>
    <Value Type='Lookup'>{varCaseID}</Value>
  </Eq>
</Where>
```

**Find by Person Field (Current User):**
```xml
<Where>
  <Eq>
    <FieldRef Name='Screening_x0020_Team_x0020_Member'/>
    <Value Type='Integer'>
      <UserID Type='User'>{Current User}</UserID>
    </Value>
  </Eq>
</Where>
```

**Multiple Conditions (AND):**
```xml
<Where>
  <And>
    <Eq>
      <FieldRef Name='Case_x0020_Status'/>
      <Value Type='Choice'>Awaiting Feedback</Value>
    </Eq>
    <Eq>
      <FieldRef Name='All_x0020_Feedback_x0020_Received'/>
      <Value Type='Boolean'>0</Value>
    </Eq>
  </And>
</Where>
```

---

## APPENDIX B: REGULAR EXPRESSION PATTERNS

### Token Replacement Patterns

**Pattern Format:**
```
Pattern: \[TokenName\]
Replacement: {Variable or Current Item Field}
```

**Example: Replace [CaseID]:**
```
Pattern: \[CaseID\]
String: varEmailBody
Replacement: {Current Item:Case ID}
Store result in: varEmailBody
```

**Multiple Replacements:**
```
[Repeat Regular Expression action for each token]
1. \[CaseID\] → {varCaseID}
2. \[CaseName\] → {varCaseName}
3. \[DateIdentified\] → {varDateIdentified}
...etc
```

**Person Field Tokens:**
```
Pattern: \[ScreeningMember\]
Replacement: {varCurrentScreeningMember:Display Name}

Pattern: \[Supervisor\]
Replacement: {varSupervisor:Display Name}
```

---

## APPENDIX C: QUICK REFERENCE CARD

### SharePoint Groups
| Group | Purpose |
|-------|---------|
| CRW Administrators | Full control, system management |
| CRW Workgroup | Create/manage cases, view all feedback |
| CRW Screening Team | Submit feedback, view assigned cases |
| CRW Supervisors | View supervised members' feedback |
| CRW Service Teams | Submit cases, upload documents |
| CRW Intake Team | Provide intake feedback |

### Workflow Triggers
| Workflow | Trigger | Condition |
|----------|---------|-----------|
| Case Initialization | Item Created | Case Review |
| Request Feedback | Item Modified | Case Status = Awaiting Feedback |
| Feedback Manager | Item Created/Modified | Feedback Submissions |
| Compile and Distribute | Item Modified | All Feedback Received = Yes |
| Feedback Reminder (optional) | Scheduled | Daily at 8 AM |

### Email Templates
1. Case Assignment
2. Intake Feedback Request
3. Screening Feedback Request
4. Feedback Reminder
5. Individual Feedback Delivery
6. Additional Feedback Request

### Key URLs
- Feedback Dashboard: /SitePages/FeedbackDashboard.aspx
- Case Review: /Lists/Case Review/AllItems.aspx
- Case Documents: /Case Documents/Forms/AllItems.aspx
- Feedback Submissions: /Lists/Feedback Submissions/AllItems.aspx

---

**END OF CONFIGURATION GUIDE**

---

*This guide provides complete configuration for a secure, automated case review system using SharePoint 2016 and Nintex Workflow 4.4.1.0. All requirements, including RBAC permissions, automated document creation, feedback dashboard, and reminder functionality, are addressed with exact naming conventions and detailed step-by-step instructions.*

*Version: 1.0*  
*Last Updated: February 10, 2026*
