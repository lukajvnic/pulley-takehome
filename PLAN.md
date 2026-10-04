# Personal plan for approaching this takehome

 - [ ] Respond to Jordon's email with a couple of questions
 - [ ] Implement a really strong and reliable MVP (this will take a lot of planning)
 - [ ] Add one extra feature that brings it together
 - [ ] make it live, put it on my website (with password for security)
 - [ ] record a loom walkthrough

## assumptions

 - standard response template

## questions

 - file empty, probably just examples
 - is there purposefully no auth? just one account?
 - scope? should i make any changes outside of the comment review portion?

## what is expected of me, concretely

 - click "comments recieved" prompts file upload for pdf comments
 - pdf extraction of relevant details into a standardized json format
 - display comments cleanly on site
 - make method for simple responses to comments (assign responses to users)
 - intake other response documents: updated application package, additional files
 - generate response letter
 - submit for re-review button

## potential extra features (pick one)

 - pdf viewer in site, with comments highlighting them
 - click on comment for link to where it was found in the pdf
 - click on things the comment mentions for link to where it was found in application (not possible right now)

## challenges

 - deciding if i should reuse/modify document for comments, create two separate schemas, or make a superschema with subschemas document and comments
 - deciding which fields to put in schemas, e.g. which fields to put in Comment
 - re-parsing would delete any comment responses (block reparsing)
    - requires adding manual edits if no reparse
    - would reparsing even work if temp is low or zero?
    - decided on no re-parse, meaning no endpoint for parse. parse only starts from upload

## design choices

 - modifying document schema
 - using gpt-6 luna
 - review cycles
 - what we submitted split by review cycle, paired with comments

## todo

- make README
- thoroughly test and walk through
- potentially deploy?

## Implementation Plan

### schema
(class table inheritance)
 - create three new schemas:  
    - SubmittalDocument (fields unique to original document that are unnecessary for commentletter)
        - documentId  // primary key, same as Document.id
        - kind
        - status
        - document
    - CommentLetter
        - documentId  // primary key, same as Document.id
        - round  // computed locally
        - letterDate  // filled in by parse
        - reviewerName  // filled in by parse
        - parseStatus
        - parseError
        - document
        - comments[]
        - notes[]  // additional important info that aren't part of comments (not necessary for MVP)
    - Comment
        - id
        - letterId
        - number
        - position
        - discipline
        - text
        - sheetRefs
        - codeRefs
        - commentType (correction, informational, administrative)
        - response
        - attachments[SubmittalDocument]
        - assigneeId  // optional, references User.id
        - assignee
        - letter
 - Update document to just have
    - id
    - approvalId
    - name
    - type
    - filePath
    - uploadedAt
    - approval

### UI Plan
 - clicking comments recieved should prompt for pdf upload
    - will be single PDF for MVP
 - in backend: take pdf and kick off parsing
 - user is now on comments stage
 - show list of comments
    - horizontal rows, listed by position order, with info in the following order:
    - (AI GENERATED SUMMARY TITLE??)
    - (number, discipline, sheet-refs [dropdown], code-refs [dropdown], assignee, text, response)