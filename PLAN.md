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

## Implementation Plan

### schema
(class table inheritance)
 - create three new schemas:  
    - SubmittalDocument (fields unique to original document that are unnecessary for commentletter)
        - id
        - kind
        - status
        - document
    - CommentLetter
        - id
        - round
        - receivedAt  // filled in by parse
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
        - discipline
        - text
        - sheetRefs
        - codeRefs
        - commentType (correction, informational, administrative)
        - letter
 - Update document to just have
    - id
    - approvalId
    - name
    - type
    - filePath
    - uploadedAt
    - approval

### pdf upload
 - clicking comments recieved should prompt for pdf upload
 - save uploaded pdfs to uploads folder
 - 
