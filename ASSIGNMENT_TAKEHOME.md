# Assignment: Responding to Review Comments

## Background

Customers need to get their construction drawings approved by the city before they start building. Their architects submit a set of drawings, the city reviews them, and either approves them or sends back comments: a list of everything that has to be resolved before they'll approve. Architect teams address every comment, resubmit a packaged response, and the loop repeats until the drawings are approved. Most sets go through two or three rounds of comments. 

We've provided some examples of comments from real projects for you to work with.

## What to build

**Build a tool that helps a team starting from receiving a comment letter to creating a response they could send back to the city.**

By the end, someone should be able to complete a comment workflow end-to-end, from uploading a comment letter to responding to each comment to submitting those responses to Pulley.

Beyond that, the shape is yours: how a letter gets into the app, what the team sees, what "responding" means in the product, and what data model sits behind it. It's up to you to decide what's important and where to invest your effort.

The repo is a small scaffold, not a finished product, but it has working examples of most things you'll need: Prisma models and migrations, API route handlers, file upload and serving, and the page and component structure. Follow those where they help you; deviate where you have a good reason.

We encourage you to build AI features. Supply your own API key(s) in `.env`; keys are not provided. The example `.env` includes entries for OpenAI and Anthropic, but you can use any model, provider, or library you like.

## What we're evaluating

- Product thinking
- User interface and experience
- Technical architecture
- Code quality

## How we'll look at it

We'll set up a video call where you'll walk through your solution. You'll give a quick demo of your solution, and then we'll do a Q&A to dig into what you built, why you built it that way, the tradeoffs you made, and what you'd do differently with more time and resources.

## Ground rules

- You may use any libraries you like.
- AI coding assistants are encouraged. You do not need to know every line of code, but you should expect to defend design decisions in the Q&A.
- Ask questions! The requirements here are intentionally open. Working out what to build, and what to ask about before building it, is part of the job and part of what we're evaluating.

## Deliverables

The demo of your working application and the code. Your code should ideally be in a state that you'd be ready to push it as a PR.

Keep in mind that we want to see an end-to-end solution and for you to be able to explain what you built; it's up to you to decide how to prioritize your time and which features are most important to develop fully and which can be left to be improved later.
