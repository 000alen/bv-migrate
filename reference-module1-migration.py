#!/usr/bin/env python3
"""
New Module 1 Migration: Google Doc PDF → Circle LMS
Creates "New Module 1 - DREAM: Learn, borrow, adapt" in Foundation Year space group.

Structure: Course Space → Sections (Units) → Lessons
All content as draft. Interactive elements tracked for Genially replacement.
"""

import json, sys, os, time, re
import urllib.request

API_BASE = "https://app.circle.so/api/admin/v2"
FOUNDATION_YEAR_GROUP_ID = 1006001

class CircleAPI:
    def __init__(self, token, dry_run=False):
        self.token = token
        self.dry_run = dry_run
        self.call_count = 0
    
    def _request(self, method, path, data=None):
        url = f"{API_BASE}{path}"
        headers = {
            "Authorization": f"Token {self.token}",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        }
        body = None
        if data is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(data).encode()
        
        if self.dry_run:
            print(f"  [DRY RUN] {method} {path}")
            if data:
                preview = json.dumps(data)[:200]
                print(f"            {preview}")
            return {"id": self.call_count + 1000, "dry_run": True}
        
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            self.call_count += 1
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read().decode())
                return result
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            print(f"  ERROR {e.code}: {error_body[:500]}")
            raise
    
    def post(self, path, data):
        return self._request("POST", path, data)
    
    def create_course_space(self, name, slug=None, space_group_id=None):
        if not slug:
            slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
        data = {
            "name": name,
            "slug": slug,
            "space_type": "course",
            "is_private": False,
            "is_post_disabled": True,
            "course_setting": {
                "course_type": "self_paced",
                "enforce_lessons_order": False,
                "custom_lesson_label": "lesson",
                "custom_section_label": "unit"
            }
        }
        if space_group_id:
            data["space_group_id"] = space_group_id
        print(f"\n{'='*60}")
        print(f"Creating course: {name}")
        print(f"{'='*60}")
        result = self.post("/spaces", data)
        space = result.get("space", result)
        print(f"→ Space ID: {space.get('id')}")
        return space
    
    def create_section(self, space_id, name):
        data = {"name": name, "space_id": space_id}
        print(f"\n  Creating section: {name}")
        result = self.post("/course_sections", data)
        print(f"  → Section ID: {result.get('id')}")
        return result
    
    def create_lesson(self, section_id, name, body_html, status="draft"):
        data = {
            "section_id": section_id,
            "name": name,
            "status": status,
            "body_html": body_html,
            "is_comments_enabled": True
        }
        print(f"    Creating lesson: {name}")
        result = self.post("/course_lessons", data)
        print(f"    → Lesson ID: {result.get('id')}")
        return result


# ─── CONTENT BUILDER ─────────────────────────────────────────────
# Each function returns HTML for one lesson.
# Square-bracket instructions from the PDF become:
#   - [Labeled image] → placeholder with GENIALLY tag
#   - [Sorting activity] → placeholder with GENIALLY tag  
#   - [Padlet] → placeholder with GENIALLY tag
#   - [Flashcards] → blockquote pairs
#   - [Accordion] → nested blockquotes with headers
#   - [Multiple choice] → quiz format
#   - [Checklist] → checkbox list
#   - [Buttons stack] → linked buttons
#   - [image (N)] → image placeholder

def img_placeholder(n=1, desc=""):
    """Image placeholder — Circle API strips <img> tags, so we mark where images go."""
    tag = f" — {desc}" if desc else ""
    return f'<p>📷 <strong>[IMAGE {n}{tag}]</strong></p>'

def genially_placeholder(name, desc=""):
    """Interactive component placeholder for Genially replacement."""
    tag = f": {desc}" if desc else ""
    return f'<p>🎮 <strong>[INTERACTIVE — {name}{tag}]</strong> <em>(Replace with Genially)</em></p>'

def flashcards_html(cards):
    """Convert flashcard pairs to blockquote format."""
    parts = []
    for front, back in cards:
        parts.append(
            f'<blockquote>'
            f'<p><strong>💡 {front}</strong></p>'
            f'<p>{back}</p>'
            f'</blockquote>'
        )
    return '\n'.join(parts)

def accordion_html(tabs):
    """Convert accordion tabs to structured HTML."""
    parts = []
    for title, content in tabs:
        parts.append(f'<h4>▸ {title}</h4>')
        parts.append(f'{content}')
    return '\n'.join(parts)

def quiz_html(question, options, correct_idx, feedback_correct, feedback_incorrect):
    """Multiple choice question."""
    parts = [f'<p><strong>❓ {question}</strong></p>', '<ol>']
    for i, opt in enumerate(options):
        marker = " ✓" if i == correct_idx else ""
        parts.append(f'<li>{opt}{marker}</li>')
    parts.append('</ol>')
    parts.append(f'<p>✅ <em>{feedback_correct}</em></p>')
    parts.append(f'<p>❌ <em>{feedback_incorrect}</em></p>')
    return '\n'.join(parts)

def buttons_stack_html(buttons):
    """Link buttons."""
    parts = []
    for label, url, desc in buttons:
        parts.append(f'<p>🔗 <a href="{url}"><strong>{label}</strong></a><br>{desc}</p>')
    return '\n'.join(parts)


# ─── LESSON CONTENT ──────────────────────────────────────────────

def arrival_lesson1():
    """Welcome to Module 1"""
    return f"""
<p><strong>Welcome, Visioneer!</strong></p>
<p>Learn how to research smarter and build better by borrowing from what already works. This first module helps you uncover, adapt, and remix proven solutions to drive meaningful, context-aware innovation.</p>
<p>⏱ <strong>Estimated completion time:</strong> 1 hour<br>
📩 <strong>Your feedback matters!</strong> Please complete the mandatory feedback survey at the end of the module.<br>
🏅 <strong>Earn a badge</strong> when you complete the module!</p>

<hr>

<h3>Module Journey</h3>
<p>Let's take a look at what you can expect and how the learning unfolds throughout this module.</p>

{genially_placeholder("LABELED IMAGE — Module Roadmap", "7 labels: Arrival → Unit 1 → Unit 2 → Eco-Spotlight → Checkpoint → Closing → Badge")}

<p><strong>Label 1: Arrival — You're here!</strong><br>
Start by understanding the learning goals and completing a short ritual to set yourself up for an effective learning process.</p>

<p><strong>Label 2: Unit 1 — Scanning the Ecosystem</strong><br>
Learn how to identify active solutions, avoid duplication, and understand what's working locally and globally.</p>

<p><strong>Label 3: Unit 2 — Ideate and Integrate</strong><br>
Dig deeper into existing solutions to uncover how they work—and where they fall short.</p>

<p><strong>Label 4: Eco-Spotlight</strong><br>
Reflect on a case study on Resource Efficiency. Apply insights and think through the planet-positive angle of your work.</p>

<p><strong>Label 5: Checkpoint 2</strong><br>
Map your problem and existing solutions and alternatives, identifying overlaps, gaps, and opportunities.</p>

<p><strong>Label 6: Closing</strong><br>
Review your achieved learning goals, receive a short unit summary, and access additional resources!</p>

<p><strong>Label 7: Earn a Module badge!</strong><br>
Complete all tasks and checkpoints in the module to earn a badge recognizing the skills you've gained. Each checkpoint includes a section highlighting the specific skills it aims to develop—through both the content leading up to it and the checkpoint activity itself.</p>

<hr>

<h3>Learning goals</h3>
<p>By the end of this module, you will be able to:</p>
<ol>
<li><strong>Identify and analyze existing solutions in your impact zone</strong> to avoid duplication and build on what already works.</li>
<li><strong>Use ecosystem mapping tools</strong> to understand the landscape of stakeholders, resources, and opportunities.</li>
<li><strong>Adapt and integrate elements from existing solutions</strong> to develop more effective and planet-positive approaches.</li>
</ol>

<hr>

<h3>Module tasks checklist</h3>
<p>Use this checklist to stay on track with the tasks to be completed during this module. By the end of the module, you should have completed:</p>
<ul>
<li>☐ Unit 1: Existing solutions exploration task</li>
<li>☐ Unit 2: Community challenge</li>
<li>☐ Planet Positivity corner: Case reflection</li>
<li>☐ <strong>Checkpoint 2:</strong> Your Challenge and Solution Mapping</li>
</ul>

<hr>

<h3>Lean Canvas</h3>
<p>As you already know, all essential modules and their checkpoints can be mapped onto the Lean Canvas. This module will support you in completing the <strong>Problem and Existing solutions &amp; alternatives</strong> sections of the Canvas.</p>

{img_placeholder(1, "Lean Canvas diagram")}

<hr>

<h3>How does this course work?</h3>

{flashcards_html([
    ("Navigation", 'Press the "Complete the lesson" button to mark it as finished. Navigate through the lessons using the menu bar on the right or the arrows next to the lesson name.'),
    ("Progress", "You don't have to complete everything at once. Take a break and come back when you're ready. Your progress will be saved!"),
    ("Completion", "Your completion will be officially recorded once you submit the module survey. You'll receive a confirmation email once your survey has been successfully submitted."),
])}
"""


def arrival_lesson2():
    """Our Ritual"""
    return f"""
<p>Remember our three-step ritual? It's here to help you activate a relevant mindset, reduce stress, and set the stage for effective learning.</p>

{img_placeholder(1, "Ritual illustration")}

<hr>

<h3>Step 1: Activate Relevant Mindsets</h3>
<p>Let's reconnect with the DOer mindsets—your foundation for innovation and action. Each time you revisit them, you build the habits that fuel your growth.</p>

{flashcards_html([
    ("Big Picture Mindset", "Move from isolated thinking to seeing how everything is connected. A big picture mindset means recognizing that challenges are interdependent—and lasting solutions must reflect that."),
    ("Lateral Mindset", "Lateral thinking helps you get unstuck by challenging assumptions and approaching problems from new angles. It's about making unexpected connections and exploring fresh ideas."),
])}

<hr>

<h3>Step 2: Practice Mindfulness</h3>
<p>This grounding exercise will help you to feel present at the current moment, and ensure your transition out of distraction and into focused presence.</p>
<p>Use your senses to bring your attention to the:</p>

<p><strong>5 things you can <em>see</em></strong><br>Look around—notice colors, textures, or light.</p>
<p><strong>4 things you can <em>touch</em></strong><br>Feel the surface of your chair, the ground under your feet, or your clothing.</p>
<p><strong>3 things you can <em>hear</em></strong><br>Tune in to ambient sounds, near or far.</p>
<p><strong>2 things you can <em>smell</em></strong><br>Subtle or strong—pause and notice.</p>
<p><strong>1 thing you can <em>taste</em></strong><br>Even if it's just the taste in your mouth, acknowledge it.</p>

<p>Take one deep, intentional breath. You're grounded, calm, and ready to engage.</p>

<hr>

<h3>Step 3: Own Your Learning</h3>
<p>Think about a time when a great idea or solution came to you unexpectedly. What were you doing just before that moment?</p>

{flashcards_html([
    ("When Ideas Strike", "When it comes to finding great ideas, effort isn't everything. In fact, expecting your best ideas to appear while you're staring at a blank screen can backfire. That's why ideas often strike while you're walking, resting, or even in the shower."),
    ("Quiet Connections", "Neuroscience shows that insight often happens when the brain is at rest, not during intense focus. Your brain keeps working behind the scenes, even when you're not actively focused on the problem. That's the Default Mode Network quietly connecting ideas in the background."),
])}

<blockquote>
<p>💡 <strong>Learning hack:</strong><br>
Alternate periods of focused effort with true mental breaks. After diving into new content or brainstorming, give your brain space. Take a walk, doodle, or just stare out the window. Let your brain do its quiet magic!</p>
</blockquote>
"""


def unit1_lesson1():
    """Why build on the shoulders of others?"""
    return f"""
<p>Innovation is often associated with novelty, disruption, or creating something entirely new. However, meaningful impact often begins with recognizing and building on what already exists. We invite you to explore how existing, proven solutions can bring you new ideas, guiding and strengthening your own project.</p>

{img_placeholder(1, "Unit 1 intro illustration")}

<hr>

<h3>Boring is Beautiful</h3>
<p>Not every effective solution is groundbreaking in appearance. In fact, the most impactful innovations are often simple and overlooked—sometimes even labeled as "boring." Yet these solutions are widely adopted, scalable, and successful for good reason.</p>

{genially_placeholder("LABELED IMAGE — Boring is Beautiful", "3 labels: Proven Effectiveness, Efficient Use of Resources, Scalability and Adaptability")}

<p><strong>Label 1: Proven Effectiveness</strong><br>Established solutions are supported by evidence and real-world outcomes. This reduces uncertainty and risk.</p>
<p><strong>Label 2: Efficient Use of Resources</strong><br>Building on existing knowledge saves time, effort, and funding—resources that can be directed to scaling or tailoring the solution.</p>
<p><strong>Label 3: Scalability and Adaptability</strong><br>Simpler systems are often easier to replicate, adapt to new environments, and integrate with local conditions.</p>

<hr>

<h3>Don't reinvent the wheel</h3>
<p>Don't start from scratch when you don't have to. Before jumping into solution-building, it's essential to ask: Has someone already solved this problem—or part of it? Below are two key principles to help you work smarter and make a bigger impact.</p>

{flashcards_html([
    ("Use What Exists", "Reusing or adapting existing tools, frameworks, and methods helps you:<br>● Save time and effort<br>● Increase your chances of success<br>● Focus on innovation"),
    ("Avoid Duplication", "When you duplicate a solution that already exists you may:<br>● Compete for the same limited resources<br>● Confuse or overwhelm your target audience<br>● Miss opportunities to scale an existing effort"),
])}

<hr>

<h3>Case: Rainwater Harvesting in Brazil</h3>

{genially_placeholder("LABELED IMAGE — Rainwater Harvesting Case", "3 labels: Problem, Solution, Impact")}

<p><strong>Problem</strong><br>In Brazil's semi-arid northeast—where drought and water scarcity are common—millions lacked reliable access to clean water. Rather than turning to expensive infrastructure, a grassroots initiative called <strong>"One Million Cisterns"</strong> took a different approach.</p>
<p><strong>Solution</strong><br>Led by civil society groups and supported by the government, the program promoted a simple, proven solution: <strong>installing 16,000-liter rainwater collection cisterns</strong> next to homes and schools. The model was inspired by traditional rainwater storage practices used in other rural areas.</p>
<p><strong>Impact</strong><br>By building on existing ideas and tailoring them to local needs, this project delivered clean water access at low cost, improved public health, and strengthened community resilience.</p>

<hr>

<h3>Three types of solutions</h3>
<p>All ideas and solutions can be grouped into three main categories. Recognizing which category your idea belongs to helps you plan strategically. Let's take a closer look at each of them!</p>

{accordion_html([
    ("New and Untested", "<p>These are completely original ideas that have not been tried or tested before. They represent innovation from scratch and often involve exploring uncharted territory.</p><p><strong>When to use:</strong></p><ul><li>When existing solutions don't address the problem</li><li>When you have unique insights or resources that enable a new approach</li><li>When the challenge demands breakthrough innovation</li></ul>"),
    ("Adapted or Remixed", "<p>This category involves taking existing ideas, tools, or methods and modifying or combining them to fit a new context or improve their effectiveness.</p><p><strong>When to use:</strong></p><ul><li>When a known solution almost fits but needs tweaking</li><li>When combining strengths from multiple existing solutions creates added value</li><li>When scaling or customizing proven models to local contexts or specific needs</li></ul>"),
    ("Proven and Reused", "<p>These are solutions that have already been tested, validated, and successfully implemented, often in multiple contexts. They are applied directly, without significant changes.</p><p><strong>When to use:</strong></p><ul><li>When time and resources are limited</li><li>When the solution matches the problem and context closely</li><li>When quick, reliable impact is a priority</li></ul>"),
])}

<hr>

<h3>Practice Corner</h3>
<p>Now, let's put what you've learned into action! Sort the cards into the correct categories based on how each idea is positioned: is it truly new, an improvement of an existing solution, or a direct reuse of something that already works?</p>

{genially_placeholder("SORTING ACTIVITY — Three Types of Solutions", "6 cards → 3 categories: New/Adapted/Proven")}

<p><strong>Category 1: New and Untested</strong></p>
<ul>
<li>A gamified app to motivate people to recycle using rewards and blockchain.</li>
<li>A smart compost bin using sensors and AI.</li>
</ul>
<p><strong>Category 2: Adapted or Remixed</strong></p>
<ul>
<li>Combining solar panels with local youth programs to address energy access and unemployment.</li>
<li>Tailoring a public transport schedule app to serve farmers during harvest season.</li>
</ul>
<p><strong>Category 3: Proven and Reused</strong></p>
<ul>
<li>A basic rainwater harvesting system used successfully in another rural area.</li>
<li>A simple food bank model from a neighboring town to serve families in need.</li>
</ul>

<p>While novelty has its place, many impactful projects start by improving or scaling what's already working. As you continue developing your idea, think about which type of solution best fits your context, your resources, and the urgency of the challenge you're trying to solve.</p>
"""


def unit1_lesson2():
    """Solutions That Came Before"""
    return f"""
<p>Many well-intentioned projects fail simply because they overlook what already exists. Here you'll find tools and strategies you need to scan your ecosystem, search smarter, and identify solutions worth building on. We'll walk through it in three stages.</p>

{img_placeholder(1, "Solutions That Came Before illustration")}

<hr>

<h3>Stage 1: Strategic Search</h3>
<p>Research doesn't have to be overwhelming if you know where to look. Many high-quality solutions already live in public directories, research reports, and project databases. You can start with the trusted platforms below, but feel free to explore any directories you're familiar with.</p>

{buttons_stack_html([
    ("Project Drawdown", "https://drawdown.org/", "A science-based guide to climate solutions"),
    ("Ashoka Changemakers, MIT Solve, WRI", "https://www.changemakers.com/en", "Innovation directories for global social and environmental projects"),
    ("UN SDG Knowledge Platform", "https://sustainabledevelopment.un.org/topics/sustainabledevelopmentgoals", "Projects aligned with the Sustainable Development Goals"),
])}

<hr>

<h3>Stage 2: Landscape Mapping</h3>
<p>Once you've found some promising ideas, or solutions that align with your challenge, it's time to understand how they fit into the bigger picture. Here are tools you can use on this stage:</p>

{accordion_html([
    ("Stakeholder Mapping", '''<p>Identify who's involved, who's affected, and who might support or resist your work.</p>
<p><strong>How to:</strong></p>
<ol>
<li><strong>List all stakeholders</strong> — Include anyone impacted by, influencing, or involved in the issue or solution.</li>
<li><strong>Categorize their roles</strong> — Are they supporters, decision-makers, critics, or beneficiaries?</li>
<li><strong>Assess their level of influence</strong> — Mark how much power or sway each stakeholder has over the project or issue.</li>
<li><strong>Identify connections</strong> — Draw links to show collaboration or dependency between stakeholders.</li>
<li><strong>Plan engagement</strong> — Decide who to inform, consult, involve, or partner with based on your map.</li>
</ol>'''),
    ("Resource Mapping", '''<p>Understand what assets, skills, and infrastructure already exist in your ecosystem.</p>
<p><strong>How to:</strong></p>
<ol>
<li><strong>Choose your focus area</strong> — Start with a theme—like education, recycling, or water access—to guide your scan.</li>
<li><strong>List existing resources</strong> — Include people, skills, tools, funding, facilities, networks, and technologies.</li>
<li><strong>Categorize your findings</strong> — Group resources into types: human, material, financial, informational, etc.</li>
<li><strong>Spot gaps and overlaps</strong> — Look for areas with too few resources—or where things are being underused.</li>
<li><strong>Think of reuse and collaboration</strong> — Highlight resources you can tap into, adapt, or share with others.</li>
</ol>'''),
    ("Mind Mapping", '''<p>Mind mapping helps you make sense of complexity and connect the dots.</p>
<p><strong>How to:</strong></p>
<ol>
<li><strong>Start with a central concept</strong> — Write the main challenge or topic in the center of your page.</li>
<li><strong>Add key branches</strong> — Around the center, draw branches for causes, effects, stakeholders, or existing solutions.</li>
<li><strong>Build out sub-branches</strong> — From each branch, add related ideas, tools, or examples. Let it grow naturally.</li>
<li><strong>Look for patterns</strong> — Are there connections between branches? Opportunities to remix or combine?</li>
<li><strong>Use insights to focus</strong> — Use the map to identify a promising direction, challenge, or innovation area.</li>
</ol>'''),
])}

<hr>

<h3>Stage 3: Understanding Local and Global Context</h3>
<p>You don't need to look far for inspiration—some of the best examples are already working around the corner or across the globe. By learning from both local efforts and global practices, you'll make smarter choices. Here are a few <strong>boring but beautiful</strong> examples:</p>

{flashcards_html([
    ("Brazil 🇧🇷", "Rural communities are using simple rainwater harvesting systems to address water scarcity. These low-tech solutions have been scaled nationally with huge impact."),
    ("India 🇮🇳", "In several cities, community composting initiatives turn food waste into soil—reducing landfill use and supporting urban agriculture, all using well-known practices."),
    ("Mexico 🇲🇽", "Rural communities are improving access to clean water by adapting ceramic water filters already used in other regions."),
])}

<hr>

<h3>Your turn!</h3>
<p>Use LinkedIn or one of the data directories shared in this lesson to explore existing solutions related to your chosen challenge. What helped you find what you were looking for? Share your searching approach on the board below so others can learn from your strategy.</p>

{genially_placeholder("PADLET BOARD", "Exploration sharing board — fellows post their search strategies")}
"""


def unit1_lesson3():
    """Supercharge your research with AI"""
    return f"""
<p>AI can help you search faster and more strategically—if you know how to prompt it well. This lesson shows you how to prompt smarter so you can uncover existing solutions, patterns, and gaps with speed and clarity.</p>

<hr>

<h3>Searching prompt questions</h3>
<p>To guide your research journey, we've grouped key prompt questions into three main categories. Use these to explore what exists, what works, and where opportunity lies. You'll find examples to help spark your thinking in each section.</p>

{accordion_html([
    ("Understand Landscape", '''<ul>
<li><strong>Who are all the different types of players in this system?</strong><br><em>List startups, corporates, governments, NGOs, communities, platforms, informal actors</em></li>
<li><strong>Map the value chain or system journey from beginning to end.</strong><br><em>Where is the most waste, friction, or harm happening?</em></li>
<li><strong>What solutions already exist across geographies?</strong><br><em>Which ones are working? Why? Which ones failed? Why?</em></li>
<li><strong>Who is funding or supporting ventures in this space?</strong><br><em>Look for prizes, grants, accelerators, policy schemes</em></li>
<li><strong>What's changing fast in this space?</strong><br><em>New tech, regulation, climate pressure, consumer demand, etc.</em></li>
</ul>'''),
    ("Borrow Solutions", '''<ul>
<li><strong>What are the smallest interventions with the biggest ripple effect?</strong><br><em>Distribution hacks? Behavior nudges? API layers? Incentive flips?</em></li>
<li><strong>What bold ideas could I 'borrow and localize' from another sector or country?</strong><br><em>Can a fintech model, marketplace, or SMS tool be applied here?</em></li>
<li><strong>What can I do with $0 or &lt;$100 that would move the needle?</strong><br><em>Email-based service? WhatsApp group? Manual dashboard?</em></li>
<li><strong>What's the <em>real</em> root problem I'm tackling — not just the symptom?</strong><br><em>Ask "Why?" five times to get to the source</em></li>
<li><strong>Which boring, overlooked problem is a goldmine in disguise?</strong><br><em>Where is no one looking because it's unsexy or unscalable?</em></li>
</ul>'''),
    ("Avoid Reinvention", '''<ul>
<li><strong>Where is everyone clustering? What space is crowded and overhyped?</strong><br><em>Look for saturated areas where too many players are solving the same problem in similar ways.</em></li>
<li><strong>Where is there deep need but no one is building yet — or only building badly?</strong><br><em>Identify neglected spaces with high impact potential and low innovation.</em></li>
<li><strong>Could I serve as the enabler or platform for other players instead of being the main actor?</strong><br><em>How to unlock value for others through infrastructure, tools, or coordination.</em></li>
<li><strong>Which existing initiatives could I amplify or join rather than compete with?</strong><br><em>Find projects aligned with my mission and what can help them scale instead of duplicating effort.</em></li>
<li><strong>What would I build if I had only one week, no money, and had to get 10 people to use it?</strong><br><em>Test your idea in the simplest possible form—think scrappy and human-first.</em></li>
</ul>'''),
])}

<hr>

<h3>Prompt examples</h3>
<p>Below are a few example prompts that show how to turn the questions above into clear, focused research instructions for your AI tool. Just copy them, adjust with your specific topic, and test how they work in practice!</p>

<blockquote>
<p><strong>[area] + [problem] = [solution]</strong></p>
<p><em>You are a renowned innovator with global expertise. I'm working on a project related to [area], but I'm facing a key challenge: [problem/barrier]. I'm looking for creative solutions to overcome this. Please provide 10 ideas based only on existing, real-world solutions that have been implemented or piloted in the [area]. Present the ideas in a table format. Additionally, rate each idea on a scale of 1–10 for value and simplicity, and explain their pros and cons.</em></p>
</blockquote>

<blockquote>
<p><strong>[area] + [main effect] + [region] = [solution]</strong></p>
<p><em>Give me examples of 5 alternative [area] technologies that are low-cost, effective at achieving [main effect], and can be created by local communities. List only those relevant to the [region]. Include a brief description and a link or source.</em></p>
</blockquote>

<blockquote>
<p><strong>[area] + [challenge] = [organizations]</strong></p>
<p><em>I'm exploring the challenge of [your challenge] within the [area]. Please identify organizations, projects, or initiatives—both local and global—that are already working on similar issues. For each, provide:</em></p>
<ul>
<li><em>A short summary of what they do</em></li>
<li><em>Where they operate</em></li>
<li><em>One insight or lesson I could apply to my own project</em></li>
</ul>
<p><em>Present the results in a table format. Prioritize practical examples with measurable outcomes.</em></p>
</blockquote>

<p>Now that you've explored how to use prompts to uncover existing solutions, you'll learn how to analyze what makes them work, where they fall short, and how you can adapt or combine them to fit your own challenge.</p>
"""


def unit2_lesson1():
    """Uncover the Gaps"""
    return f"""
<p>Proven solutions are often more adaptable than you think. In this unit you'll understand how to see gaps in current solutions, remix proven ideas, and create approaches that fit your local context.</p>

{img_placeholder(1, "Uncover the Gaps illustration")}

{quiz_html(
    "Imagine you're reviewing an existing project to see if you can build on it. Which approach is most likely to help you uncover useful insights?",
    [
        "Focus on how widely the solution has been shared online and how well it's known.",
        "Look at the visual design and communication style—it often signals how strong the idea is.",
        "Analyze how the solution works: its methods, partners, materials, and what outcomes it's achieved.",
    ],
    2,
    "You're right! Understanding how a solution actually functions helps you assess its strengths, spot limitations, and see how it might be adapted or improved for your own project.",
    "Not quite… Popularity or strong visuals might catch attention, but they don't tell you whether a solution is truly effective or adaptable. Focus on what's under the surface—how it works, who's involved, and what impact it's had."
)}

<hr>

<h3>What to Look For</h3>
<p>When studying a solution, use these questions to guide your research:</p>

{accordion_html([
    ("Business Model", "<p>How does this solution sustain itself?<br>Is it nonprofit, for-profit, hybrid?<br>Where does its funding come from?</p>"),
    ("Methods", "<p>What processes, tools, or approaches does it use?<br>Is it tech-driven? Community-based? Manual or automated?</p>"),
    ("Materials", "<p>What resources are required (physical, digital, or natural)?<br>Are these affordable and available in your region?</p>"),
    ("Partners", "<p>Who supports or implements this solution (NGOs, businesses, local government)?<br>Could you collaborate with the same or similar partners?</p>"),
    ("Impact", "<p>What results does it claim to produce?<br>Is the impact measurable?<br>Who benefits—and who might be left out?</p>"),
])}

{quiz_html(
    "After analyzing how the existing solution works, what's the best next step to uncover any gaps or weaknesses that might affect your adaptation?",
    [
        "Assume the solution is solid and start adapting it to your context right away.",
        "Look for critical feedback, missing outcomes, or groups the solution may have overlooked.",
        "Focus on the successes and try to replicate those exactly in your version.",
    ],
    1,
    "You're right! Identifying what's missing—such as who was left out, what didn't work well, or which outcomes weren't achieved—helps you spot crucial gaps. That insight is key to making your version more effective and inclusive.",
    "Not quite… Even strong solutions often have blind spots. By only focusing on successes or assuming it's ready to copy, you risk repeating the same mistakes. Take time to explore what's missing or didn't work—you'll build a stronger foundation."
)}

<hr>

<h3>Seeing What's Missing</h3>
<p>Now that you know what to examine, it's time to take a closer look at what might be missing. Even strong ideas leave room for improvement. Look for limitations that might offer space for you to add value. Use this "Gap Finder":</p>

{genially_placeholder("LABELED GRAPHIC — Gap Finder", "4 labels: Who's excluded, What's too expensive, Where does it break down, What's missing")}

<p><strong>Who's excluded or underserved?</strong><br>Does the solution miss a certain age group, income level, or remote area?</p>
<p><strong>What's too expensive or complex?</strong><br>Could the method be simplified or localized?</p>
<p><strong>Where does it break down?</strong><br>Are there issues with scale, sustainability, or adoption?</p>
<p><strong>What's missing?</strong><br>Where can you add a new feature, expand access, or make the solution more inclusive?</p>

<hr>

<h3>Try It Out!</h3>
<p>Complete this hands-on exercise to turn your knowledge into a practical skill. Simply choose an existing solution that addresses your challenge and fill out this short table in your notebook.</p>

<table>
<tr><th>Aspect</th><th>What's working</th><th>What's missing or limited</th></tr>
<tr><td><strong>Business Model</strong></td><td><em>Ex: Runs on micro-fees</em></td><td><em>Doesn't work in rural, cashless areas</em></td></tr>
<tr><td><strong>Method</strong></td><td></td><td></td></tr>
<tr><td><strong>Materials</strong></td><td></td><td></td></tr>
<tr><td><strong>Partners</strong></td><td></td><td></td></tr>
<tr><td><strong>Impact</strong></td><td></td><td></td></tr>
</table>

<p><strong>Once you've finished, reflect:</strong><br><em>What's one small improvement or unmet need you could address in your own version of this solution?</em></p>
"""


def unit2_lesson2():
    """Adapting What Works"""
    return f"""
<p>The next step is to remix, adapt, combine, and creatively rework proven ideas to better fit your local context and future needs. This is where insight meets innovation.</p>

{img_placeholder(1, "Adapting What Works illustration")}

<hr>

<h3>Creative Recombination</h3>
<p>Creative recombination is the process of taking parts of existing solutions—methods, materials, technologies, business models, or partnerships—and combining them into something new, practical, and context-specific. Here's how!</p>

{genially_placeholder("TIMELINE — Creative Recombination Process", "5 blocks: Identify → Spot → Mix → Test → Refine")}

<p><strong>1. Identify useful components</strong><br>Look at multiple solutions that work—what methods, tools, or ideas could be worth borrowing?</p>
<p><strong>2. Spot complementary strengths</strong><br>One idea might have strong community engagement; another might offer a low-cost model. Together, they could be more powerful.</p>
<p><strong>3. Mix and match</strong><br>Experiment with combinations. Start with simple pairings and build from there.<br>Use these guiding questions:<br>● What aspects of each solution work well?<br>● What could I add or change to make them more effective in my context?<br>● What new value can emerge from combining them?</p>
<p><strong>4. Test fit for your context</strong><br>Does this combined idea address your challenge effectively? Is it practical and realistic within your community's resources and constraints?</p>
<p><strong>5. Refine with feedback</strong><br>Share your remix with users or peers. Their insights can help you adapt it even further!</p>

<hr>

<blockquote>
<p><strong>Real-life example: Water filtration in Kenya</strong></p>
<p>In rural Kenya, access to clean drinking water has long been a challenge. Rather than inventing a new solution from scratch, local teams identified two existing approaches:</p>
<ul>
<li><strong>Low-tech water filtration</strong> using sand and charcoal.</li>
<li><strong>A community education model</strong> adapted from South Asia.</li>
</ul>
<p><em>By combining these two ideas, the teams didn't just distribute filters—they ensured proper usage and long-term adoption. They trained local health workers to explain how the filters worked and engaged schools and community leaders to spread awareness.</em></p>
</blockquote>

<hr>

<h3>Ideation</h3>
<p>To uncover new potential in what already exists, you need a spark—lots of them! Great ideas come from embracing two simple but powerful principles:</p>
<ol>
<li><strong>Think big, think many</strong> — The more ideas you generate, the better your chances of hitting on something truly great.</li>
<li><strong>Dare to be bold</strong> — Sometimes the wildest ideas open the door to the most exciting innovations. Don't hold back—embrace the unexpected!</li>
</ol>

{quiz_html(
    "You've identified some gaps in existing solutions. Now you want to explore how to adapt or remix them. What's the most effective way to approach this creatively?",
    [
        "Start by clustering similar existing ideas and refining the most promising one immediately.",
        "Explore a wide range of adaptations—even unlikely ones—before narrowing your focus.",
        "Look for the most efficient idea already in use and replicate it with minor tweaks.",
    ],
    1,
    "You're right! Great ideation starts with generating lots of ideas—even unusual ones. Once you have a big pool to choose from, then you can analyze and select the best ones. This two-step process leads to stronger and more original outcomes.",
    "Not quite… Jumping into clustering or picking the most efficient solution too early skips a crucial creative phase. First, generate broadly—even ideas that seem unrealistic. This opens the door to truly innovative recombinations later."
)}

<hr>

<h3>Future Focus</h3>
<p>A key part of adapting what works is not just looking backward at existing solutions—but also looking ahead. The goal is to adapt with future needs, evolving contexts, and potential changes in mind. Here are three essential components to consider:</p>

{flashcards_html([
    ("Ask yourself…", "Will this solution still be relevant in 2, 5, or 10 years?<br>How might climate, technology, or demographics shift?<br>Is the solution flexible enough to evolve?"),
    ("Look for ideas that…", "Are easy to update or expand<br>Can grow with your community<br>Align with emerging trends or policies"),
    ("Pay attention to…", "Global reports<br>Youth-led movements and community feedback<br>New tech or social behaviors in other regions"),
])}

<p>As you can see, adaptation is not imitation. It's about understanding the building blocks of successful solutions and rearranging them to fit new needs. As you generate ideas, remember: your goal is not to be original—it's to be effective.</p>
"""


def unit2_lesson3():
    """Community Challenge"""
    return f"""
<h3>Community Challenge</h3>
<p>You did a great job and are now ready for a Community Challenge of the Module 1!</p>

{flashcards_html([
    ("What is a Community Challenge?", "An activity related to this module's topics that helps you connect with other Visioneers!"),
    ("Why take part?", "To expand your network, exchange ideas with like-minded changemakers, and co-create impactful solutions."),
    ("Share it!", "After completing the challenge, share your reflections and key insights on social media using #bVCommunityChallenge."),
])}

<hr>

<h3>Immerse Yourself in the Problem</h3>
<p>This challenge invites you to step into the real-world context of your environmental challenge. Instead of starting with solutions, your goal is to experience the problem from multiple perspectives.</p>

{genially_placeholder("LABELED IMAGE — Community Challenge Steps", "4 steps: Form Circle → Plan Exploration → Share Discoveries → Reflect")}

<p><strong>Step 1: Form Your Circle</strong><br>Find 3–6 Fellows in your Impact Zone. Invite peers who are working on different aspects of the same environmental issue. The diversity of perspectives will make the challenge richer.</p>

<p><strong>Step 2: Plan Your Exploration</strong><br>Choose one or two exploration methods that your group can carry out before your next meeting:</p>
<ul>
<li>Interview people directly affected by the issue</li>
<li>Visit or observe the problem in its real environment</li>
<li>Explore public reports, datasets, or maps related to your Impact Zone</li>
<li>Volunteer with or speak to a local organization or startup working on the issue</li>
<li>Watch a documentary or read an investigative article about the challenge</li>
</ul>

<p><strong>Step 3: Share What You Discovered</strong><br>Meet as a group and take turns sharing what you learned:</p>
<ul>
<li>What surprised you during your exploration?</li>
<li>What challenges do people experience most strongly?</li>
<li>Did you notice any patterns or recurring stories?</li>
</ul>

<p><strong>Step 4: Reflect</strong><br>Post a short reflection about your exploration on bVLC or social media using the hashtag <strong>#bVCommunityChallenge</strong>.<br>By sharing your experiences, you help the community better understand the realities behind the challenges we are working to solve.</p>
"""


def eco_spotlight_lesson1():
    """Your Planet-positivity corner"""
    return f"""
<p>Welcome to the Planet Positivity Corner—a space to pause, reflect, and learn from real-world stories. In each module, you'll explore one short case study and respond to two reflective questions. These stories aren't just inspiring—they're practical examples that help you strengthen the mindset and skills needed to solve problems with the planet in mind.</p>

{img_placeholder(1, "Planet Positivity Corner illustration")}

<hr>

<h3>Building More with Less in Morocco</h3>
<p>In rural parts of Morocco, farmers face high levels of post-harvest food waste due to a lack of affordable cold storage. Many communities are off the electricity grid, and traditional refrigeration is too expensive or unreliable, especially in hot climates.</p>

{genially_placeholder("LABELED IMAGE — Morocco Case Study", "3 labels: Solution, Impact, Lessons learned")}

<p><strong>Solution</strong><br>A local team created a low-tech evaporative cooling chamber inspired by traditional clay pot refrigeration from India and Nigeria. Using only local, low-cost materials like clay, sand, and recycled bricks, they built it with community involvement and paired it with training on food handling and shared maintenance.</p>

<p><strong>Impact</strong></p>
<ul>
<li>Post-harvest losses for smallholder farmers dropped by up to 60%</li>
<li>The cooling chambers extended shelf life for fruits and vegetables by 5–10 days</li>
<li>Community ownership increased long-term maintenance and adaptation of the system</li>
<li>The model has since been replicated in two neighboring regions using the same approach</li>
</ul>

<p><strong>Lessons learned</strong></p>
<ul>
<li>Remixing traditional knowledge with local materials can lead to affordable and scalable solutions</li>
<li>Community involvement from the start increases both adoption and impact</li>
<li>Sometimes, the best innovations are low-tech, context-specific adaptations—not high-tech imports</li>
</ul>

<hr>

<h3>Your Turn!</h3>
<p>Reflect on these two questions about what makes a solution successful, and share your answers on the board below.</p>

{genially_placeholder("PADLET BOARD — Planet Positivity Reflection", "Q1: What elements of this solution made it successful? Q2: What existing practices could be remixed?")}

<p><em>Question 1: What elements of this solution made it successful and replicable in a rural setting?</em></p>
<p><em>Question 2: Think of a problem in your area. What existing practices could be remixed or reused to address it?</em></p>
"""


def checkpoint2():
    """Checkpoint 2: Your Challenge and Solution Mapping"""
    return f"""
<p><strong>Welcome to the second project Checkpoint!</strong><br>
Before creating your solution, it's important to understand the challenge deeply and explore what's already being done. This checkpoint will help you to identify opportunities where your idea can make a difference.</p>

{img_placeholder(1, "Checkpoint 2 intro")}

<p>Second Checkpoint focuses on completing the <strong>Problem</strong> and <strong>Existing solutions &amp; alternatives</strong> sections of the Lean Canvas. You've explored how to uncover gaps in existing solutions and creatively adapt what already works.</p>

{img_placeholder(2, "Lean Canvas highlighted sections")}

<hr>

<h3>Challenge and Solution Mapping</h3>
<p>Follow these steps to map the landscape of existing solutions. Your goal is to uncover what's already been tried—locally and globally—what's working (or not), and how your solution can add value or fill the gaps.</p>

{accordion_html([
    ("Step 1: Describe the Challenge", "<p>Focus on how the challenge is experienced by those impacted and how it connects to broader issues.</p><p><strong>Focus questions to answer:</strong></p><ul><li>How do those most impacted describe the challenge?</li><li>How do they describe the effects?</li><li>How is this challenge related to other challenges?</li></ul>"),
    ("Step 2: Impact and Cause of the Challenge", "<p>Understand both who and what is affected by the challenge and why it continues to exist. Looking at the scale of the problem and its underlying drivers will help you identify where meaningful change could happen.</p><p><strong>Focus questions to answer:</strong></p><ul><li>What are the key numbers or data that show the scale of the challenge?</li><li>Who or what is impacted (where, how many, and in what way)?</li><li>What factors or systems are causing the challenge to persist?</li><li>Who might benefit from the challenge continuing to exist?</li></ul>"),
    ("Step 3: What's happening locally and globally?", "<p>How the challenge is currently being addressed both in your local ecosystem and around the world. Understanding existing efforts and lessons learned can reveal opportunities to build on what already works and avoid repeating what hasn't.</p><p><strong>Focus questions to answer:</strong></p><ul><li>What resources, initiatives, or models already exist locally to address the challenge?</li><li>What solutions have been tried globally on similar challenges?</li><li>What lessons can be learned from these efforts?</li><li>How connected or coordinated are these approaches, and what opportunities exist to build on them?</li></ul>"),
    ("Step 4: What's working and not?", "<p>Analyze the impact of local and global solutions. Pay attention to what's succeeded, what hasn't—and why.</p><p><strong>Focus questions to answer:</strong></p><ul><li>What can be learned from the successes and failures of these efforts?</li><li>What do those involved attribute to the cause of their results?</li></ul>"),
    ("Step 5: Where's the focus and the future?", "<p>Look beyond the present. Identify gaps in current efforts and consider upcoming trends or shifts that could shape your solution's relevance.</p><p><strong>Focus questions to answer:</strong></p><ul><li>What parts of the challenge are focused on and what are ignored?</li><li>What is on the Horizon that might impact collective solutions?</li><li>What future scenarios might play out?</li></ul>"),
])}

<hr>

<h3>Your Submittable Worksheet</h3>
<p>Add your reflections from the previous exercise to this worksheet, then upload it to your bVLC Portfolio.</p>
<p>📄 <strong>[PDF FILE — Checkpoint 2 Worksheet]</strong> <em>(Attach downloadable file)</em></p>

<hr>

<h3>Fill Your Lean Canvas</h3>
<p>Keep your Lean Canvas up to date with the Lean Canvas Workbook. Download it now and update it after each Checkpoint. This step isn't mandatory, but it's a helpful way to track your progress as you work with your Venture Coach.</p>
<p>📄 <strong>[PPTX FILE — Lean Canvas Workbook]</strong> <em>(Attach downloadable file)</em></p>

<hr>

<h3>New skills unlocked!</h3>
<p>You've done a great job completing the module content, tasks, and Checkpoint 2! Here's what you've gained:</p>

{flashcards_html([
    ("Research", "I can systematically investigate and analyze information to inform decisions and strategies."),
    ("Market Research", "I can gather and interpret data about market conditions to identify opportunities and threats."),
    ("Ecosystem Mapping", "I can identify and analyze stakeholders and relationships within a system to understand dynamics."),
    ("Resource Efficiency", "I can optimize the use of resources to minimize waste and maximize value."),
    ("AI Tools", "I can utilize artificial intelligence applications to enhance productivity and decision-making."),
    ("Critical Thinking", "I can objectively evaluate information and arguments to make reasoned judgments."),
])}
"""


def closing_lesson1():
    """Module Summary"""
    return f"""
<p>Congratulations, you've made it to the end of Module 1!</p>
<p>We hope you enjoyed the journey as much as we did preparing it for you. Here you will find a summary of the key points. But first, check the status of the tasks in your Module checklist.</p>

{img_placeholder(1, "Module completion illustration")}

<hr>

<h3>Module tasks checklist</h3>
<ul>
<li>☐ Unit 1: Existing solutions exploration task</li>
<li>☐ Unit 2: Community challenge</li>
<li>☐ Planet Positivity corner: Case reflection</li>
<li>☐ <strong>Checkpoint 2:</strong> Your Challenge and Solution Mapping</li>
</ul>

<hr>

<h3>Module Cheat Sheet</h3>
<p>Check out these key takeaways from each module lesson — your quick cheat sheet!</p>

{accordion_html([
    ("Building on the Shoulders of Others", "<ul><li>Building on existing solutions saves time, resources, and reduces risk.</li><li>Proven, simple solutions often have the biggest impact.</li><li>Reinventing the wheel wastes resources and creates confusion.</li><li>Reuse or adapt tools, frameworks, or methods that already show results.</li></ul>"),
    ("Solutions That Came Before", "<ul><li>Search on trusted platforms like Drawdown, Changemakers, and the UN SDG site.</li><li>Use tools like stakeholder, resource, and mind mapping to understand the context.</li><li>Learn from both nearby and international success stories.</li><li>Understand who's involved, what's working, and what's missing.</li></ul>"),
    ("Supercharge Your Research with AI", "<ul><li>Clear, detailed prompts yield better results.</li><li>Prompts can generate ideas, compare solutions, or identify organizations.</li><li>Tailor searches to your challenge, area, and region.</li><li>Use ChatGPT's output as a starting point, not the final answer.</li></ul>"),
    ("Uncover the Gaps", "<ul><li>Study business models, methods, materials, partners, and impact.</li><li>Look for what's missing, too complex, or doesn't scale well.</li><li>Identify who's excluded, what breaks down, and where value can be added.</li><li>Use gaps as an entry point for meaningful innovation.</li></ul>"),
    ("Adapting What Works", "<ul><li>Borrow methods, tools, or models from multiple sources.</li><li>Ensure your remix fits your local needs, constraints, and culture.</li><li>Test and refine based on real input from users or peers.</li><li>Make sure your solution is flexible, future-ready, and able to evolve.</li></ul>"),
])}

<p>📄 <strong>[PDF FILE — Module Summary]</strong> <em>(Attach downloadable file)</em></p>
"""


def closing_lesson2():
    """Additional Resources"""
    return f"""
<p><strong>Want to explore the topics from Module 1 further?</strong><br>
Whether you're revisiting key concepts or discovering real-world applications, these resources will expand your understanding and inspire you to take the next step!</p>

{img_placeholder(1, "Additional Resources illustration")}

<hr>

<h3>Read</h3>

{buttons_stack_html([
    ("Where Good Ideas Come From (Book)", "https://www.google.de/books/edition/Where_Good_Ideas_Come_From/eOfUiUNby3cC?hl=en&gbpv=1&pg=PT8&printsec=frontcover", "How breakthrough ideas emerge from networks and remixing existing concepts."),
    ("Lean Startup Principles", "https://theleanstartup.com/principles", "Offers a foundational mindset for adapting what works."),
    ("What is Adjacent Innovation", "https://www.innosabi.com/resources/post/what-is-adjacent-innovation?utm_source=chatgpt.com", "How expanding on your core strengths into related areas drives sustainable growth and impact."),
])}

<hr>

<h3>Watch</h3>

{buttons_stack_html([
    ("Principles of Creative Problem Solving", "https://youtu.be/C-2l1p6CvEs", "In this video Nihal talks about the fundamental principles of creative problem-solving."),
    ("Thinking in First Principle", "https://youtu.be/ChONehrmDNg", "This video explains how questioning things to its fundamentals unlocks new opportunities and possibilities."),
    ("Analogy Thinking", "https://www.youtube.com/watch?v=ewga4NIhDnc", "How making connections between unrelated fields helps generate creative adaptations."),
    ("The AI Creativity Multiplier", "https://www.youtube.com/watch?v=vmZSaEYrWNU&t=2s", "Illustrates how AI can support creative ideation by expanding idea generation."),
])}

<hr>

<h3>Hear</h3>

{buttons_stack_html([
    ("In Praise of Maintenance Podcast", "https://freakonomics.com/podcast/in-praise-of-maintenance-update/", "This podcast shows why maintaining and scaling proven systems can be more impactful than chasing novelty."),
    ("The Solve Effect Podcast", "https://solve.mit.edu/resources/the-solve-effect", "Each episode explores the journeys of people rewriting the rules for global challenges."),
])}
"""


def closing_lesson3():
    """Feedback Survey"""
    return f"""
<p><strong>Thank you for completing Module 1!</strong></p>
<p>Your feedback helps us improve the learning experience for all Visioneers. Please take a few minutes to complete this mandatory survey.</p>

<p>📋 <strong>[FEEDBACK SURVEY EMBED]</strong> <em>(Embed survey link here)</em></p>

<p>Your completion will be officially recorded once you submit this survey. You'll receive a confirmation email once your survey has been successfully submitted.</p>
"""


# ─── COURSE STRUCTURE ─────────────────────────────────────────────

COURSE_STRUCTURE = {
    "name": "New Module 1 - DREAM: Learn, borrow, adapt",
    "slug": "new-module-1-dream-learn-borrow-adapt",
    "sections": [
        {
            "name": "Arrival",
            "lessons": [
                ("Welcome to Module 1", arrival_lesson1),
                ("Our Ritual", arrival_lesson2),
            ]
        },
        {
            "name": "Unit 1: Scanning the Ecosystem",
            "lessons": [
                ("Why build on the shoulders of others?", unit1_lesson1),
                ("Solutions That Came Before", unit1_lesson2),
                ("Supercharge your research with AI", unit1_lesson3),
            ]
        },
        {
            "name": "Unit 2: Ideate and Integrate",
            "lessons": [
                ("Uncover the Gaps", unit2_lesson1),
                ("Adapting What Works", unit2_lesson2),
                ("Community Challenge", unit2_lesson3),
            ]
        },
        {
            "name": "Eco-Spotlight",
            "lessons": [
                ("Your Planet-positivity corner", eco_spotlight_lesson1),
            ]
        },
        {
            "name": "Checkpoint 2",
            "lessons": [
                ("Your Challenge and Solution Mapping", checkpoint2),
            ]
        },
        {
            "name": "Closing",
            "lessons": [
                ("Module Summary", closing_lesson1),
                ("Additional Resources", closing_lesson2),
                ("Feedback Survey", closing_lesson3),
            ]
        },
    ]
}


# ─── INTERACTIVE ELEMENTS TRACKER ─────────────────────────────────

INTERACTIVE_ELEMENTS = [
    {"section": "Arrival", "lesson": "Welcome to Module 1", "type": "labeled_image", "desc": "Module roadmap — 7 labels showing course flow"},
    {"section": "Arrival", "lesson": "Welcome to Module 1", "type": "image", "desc": "Lean Canvas diagram"},
    {"section": "Arrival", "lesson": "Our Ritual", "type": "image", "desc": "Ritual illustration"},
    {"section": "Unit 1: Scanning the Ecosystem", "lesson": "Why build on the shoulders of others?", "type": "image", "desc": "Unit 1 intro illustration"},
    {"section": "Unit 1: Scanning the Ecosystem", "lesson": "Why build on the shoulders of others?", "type": "labeled_image", "desc": "Boring is Beautiful — 3 labels"},
    {"section": "Unit 1: Scanning the Ecosystem", "lesson": "Why build on the shoulders of others?", "type": "labeled_image", "desc": "Rainwater Harvesting Brazil case — 3 labels"},
    {"section": "Unit 1: Scanning the Ecosystem", "lesson": "Why build on the shoulders of others?", "type": "sorting_activity", "desc": "Three Types of Solutions — 6 cards into 3 categories"},
    {"section": "Unit 1: Scanning the Ecosystem", "lesson": "Solutions That Came Before", "type": "image", "desc": "Solutions That Came Before illustration"},
    {"section": "Unit 1: Scanning the Ecosystem", "lesson": "Solutions That Came Before", "type": "padlet", "desc": "Exploration sharing board"},
    {"section": "Unit 2: Ideate and Integrate", "lesson": "Uncover the Gaps", "type": "image", "desc": "Uncover the Gaps illustration"},
    {"section": "Unit 2: Ideate and Integrate", "lesson": "Uncover the Gaps", "type": "labeled_graphic", "desc": "Gap Finder — 4 labels"},
    {"section": "Unit 2: Ideate and Integrate", "lesson": "Adapting What Works", "type": "image", "desc": "Adapting What Works illustration"},
    {"section": "Unit 2: Ideate and Integrate", "lesson": "Adapting What Works", "type": "timeline", "desc": "Creative Recombination — 5 steps"},
    {"section": "Unit 2: Ideate and Integrate", "lesson": "Community Challenge", "type": "labeled_image", "desc": "Community Challenge 4 steps"},
    {"section": "Eco-Spotlight", "lesson": "Your Planet-positivity corner", "type": "image", "desc": "Planet Positivity Corner illustration"},
    {"section": "Eco-Spotlight", "lesson": "Your Planet-positivity corner", "type": "labeled_image", "desc": "Morocco case study — 3 labels"},
    {"section": "Eco-Spotlight", "lesson": "Your Planet-positivity corner", "type": "padlet", "desc": "Planet Positivity reflection board"},
    {"section": "Checkpoint 2", "lesson": "Your Challenge and Solution Mapping", "type": "image", "desc": "Checkpoint 2 intro + Lean Canvas"},
    {"section": "Checkpoint 2", "lesson": "Your Challenge and Solution Mapping", "type": "file", "desc": "PDF: Checkpoint 2 Worksheet"},
    {"section": "Checkpoint 2", "lesson": "Your Challenge and Solution Mapping", "type": "file", "desc": "PPTX: Lean Canvas Workbook"},
    {"section": "Closing", "lesson": "Module Summary", "type": "image", "desc": "Module completion illustration"},
    {"section": "Closing", "lesson": "Module Summary", "type": "file", "desc": "PDF: Module Summary"},
    {"section": "Closing", "lesson": "Additional Resources", "type": "image", "desc": "Additional Resources illustration"},
    {"section": "Closing", "lesson": "Feedback Survey", "type": "survey_embed", "desc": "Feedback survey link/embed"},
]


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Migrate New Module 1 to Circle")
    parser.add_argument("--dry-run", action="store_true", help="Preview without API calls")
    parser.add_argument("--token-file", default=os.path.expanduser("~/.openclaw/.secrets/circle-api.json"))
    args = parser.parse_args()
    
    # Load token
    with open(args.token_file) as f:
        token = json.loads(f.read().strip())["token"]
    
    api = CircleAPI(token, dry_run=args.dry_run)
    
    # Create course space
    space = api.create_course_space(
        COURSE_STRUCTURE["name"],
        slug=COURSE_STRUCTURE["slug"],
        space_group_id=FOUNDATION_YEAR_GROUP_ID
    )
    space_id = space.get("id")
    time.sleep(0.5)
    
    results = {"space_id": space_id, "sections": [], "interactive_elements": INTERACTIVE_ELEMENTS}
    
    total_lessons = sum(len(s["lessons"]) for s in COURSE_STRUCTURE["sections"])
    lesson_count = 0
    
    for section_def in COURSE_STRUCTURE["sections"]:
        sec = api.create_section(space_id, section_def["name"])
        section_id = sec.get("id")
        time.sleep(0.3)
        
        section_result = {"id": section_id, "name": section_def["name"], "lessons": []}
        
        for lesson_name, content_fn in section_def["lessons"]:
            body_html = content_fn()
            les = api.create_lesson(section_id, lesson_name, body_html, status="draft")
            lesson_count += 1
            time.sleep(0.3)
            
            section_result["lessons"].append({
                "id": les.get("id"),
                "name": lesson_name
            })
            print(f"      [{lesson_count}/{total_lessons}]")
        
        results["sections"].append(section_result)
    
    # Save results
    log_path = os.path.join(os.path.dirname(__file__), "new-module1-import-log.json")
    with open(log_path, "w") as f:
        json.dump(results, f, indent=2)
    
    # Save interactive elements tracker
    tracker_path = os.path.join(os.path.dirname(__file__), "new-module1-interactive-tracker.json")
    with open(tracker_path, "w") as f:
        json.dump(INTERACTIVE_ELEMENTS, f, indent=2)
    
    print(f"\n{'='*60}")
    print(f"✓ Migration complete!")
    print(f"  API calls: {api.call_count}")
    print(f"  Sections: {len(COURSE_STRUCTURE['sections'])}")
    print(f"  Lessons: {lesson_count}")
    print(f"  Interactive elements to replace: {len(INTERACTIVE_ELEMENTS)}")
    print(f"  All lessons created as DRAFT")
    print(f"  Import log: {log_path}")
    print(f"  Interactive tracker: {tracker_path}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
