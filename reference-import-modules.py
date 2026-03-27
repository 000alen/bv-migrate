#!/usr/bin/env python3
"""
Import Modules 2-8 to Circle as new courses with "New" prefix.
Interactives: title only, no full description.
"""

import json, sys, os, time, re, subprocess

API_BASE = "https://app.circle.so/api/admin/v2"
SPACE_GROUP_ID = 1006001  # Foundation Year

class CircleAPI:
    def __init__(self, token, dry_run=False):
        self.token = token
        self.dry_run = dry_run
        self.call_count = 0

    def _request(self, method, path, data=None):
        url = f"{API_BASE}{path}"

        if self.dry_run:
            print(f"  [DRY RUN] {method} {path}")
            if data:
                print(f"            {json.dumps(data)[:200]}")
            return {"id": self.call_count + 1000, "dry_run": True}

        cmd = [
            "curl", "-s", "-X", method,
            "-H", f"Authorization: Token {self.token}",
            "-H", "Accept: application/json",
        ]
        if data is not None:
            cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(data)]
        cmd.append(url)

        self.call_count += 1
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            print(f"  CURL ERROR: {result.stderr[:300]}")
            raise Exception(f"curl failed: {result.stderr}")
        
        try:
            parsed = json.loads(result.stdout)
        except json.JSONDecodeError:
            if "429" in result.stdout or "rate" in result.stdout.lower():
                print("  Rate limited — waiting 10s...")
                time.sleep(10)
                return self._request(method, path, data)
            print(f"  PARSE ERROR: {result.stdout[:300]}")
            raise Exception(f"Invalid JSON response: {result.stdout[:200]}")
        
        if isinstance(parsed, dict) and parsed.get("error"):
            print(f"  API ERROR: {parsed}")
            raise Exception(f"API error: {parsed}")
        
        return parsed

    def post(self, path, data):
        return self._request("POST", path, data)

    def create_course(self, name, slug=None):
        if not slug:
            slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
        data = {
            "name": name,
            "slug": slug,
            "space_type": "course",
            "is_private": False,
            "is_post_disabled": True,
            "space_group_id": SPACE_GROUP_ID,
            "course_setting": {
                "course_type": "self_paced",
                "enforce_lessons_order": False,
                "custom_lesson_label": "lesson",
                "custom_section_label": "module"
            }
        }
        print(f"  Creating course: {name}")
        result = self.post("/spaces", data)
        return result.get("space", result)

    def create_section(self, space_id, name):
        data = {"name": name, "space_id": space_id}
        print(f"    Section: {name}")
        return self.post("/course_sections", data)

    def create_lesson(self, section_id, name, body_html, status="draft"):
        data = {
            "name": name,
            "section_id": section_id,
            "body_html": body_html,
            "status": status,
            "is_comments_enabled": True
        }
        print(f"      Lesson: {name}")
        result = self.post("/course_lessons", data)
        return result.get("lesson", result)


# ─── MODULE DEFINITIONS ───

MODULES = {
    2: {
        "name": "New Module 2: DREAM — Refining Problems With User Insights",
        "phase": "Dream",
        "time": "1 hour 30 min",
        "learning_goals": [
            "Gather and interpret user insights to better understand the real needs and challenges within your impact zone.",
            "Identify patterns and root causes behind environmental problems using the Iceberg Model.",
            "Connect user perspectives with deeper system-level insights to build a solid foundation for your project."
        ],
        "checkpoint": "Checkpoint 3: Your Iceberg model for user insights",
        "lean_canvas": "Target Audience",
        "sections": [
            {
                "title": "Arrival",
                "lessons": [
                    {
                        "title": "Welcome to Module 2",
                        "content": "welcome",
                        "checklist": [
                            "Unit 1: Identify your user research method",
                            "Unit 2: Making sense of your data exercise",
                            "Unit 3: Community Challenge",
                            "Planet Positivity corner: Case reflection",
                            "Checkpoint 3: Your Iceberg model for user insights"
                        ],
                        "roadmap": [
                            ("Arrival", "You're here! Start by understanding the learning goals and completing a short ritual to set yourself up for an effective learning process."),
                            ("Unit 1: Data Gathering and Needfinding", "Learn to collect meaningful user insights using research tools and reframing techniques to uncover real needs."),
                            ("Unit 2: Making Constellations", "Explore how to organize your data to spot patterns, extract key insights, and build a system that works for you."),
                            ("Unit 3: Iceberg Model", "Use the Iceberg Model to look beneath the surface and identify root causes behind the problem."),
                            ("Eco-Spotlight", "Reflect on a case study on Environmental Problem-Solving."),
                            ("Checkpoint 3", "Map your user insights using the Iceberg Model to clarify root causes and refine your Lean Canvas."),
                            ("Closing", "Review your achieved learning goals, access additional resources, and share useful materials with other fellows!")
                        ]
                    },
                    {"title": "Our Ritual", "content": "ritual"}
                ]
            },
            {
                "title": "Data Gathering and Needfinding",
                "lessons": [
                    {"title": "Being User-centric", "topics": ["What are user insights", "What is user-centricity", "User-centered research toolkit", "Principles of needfinding"]},
                    {"title": "Types of Research", "topics": ["Different types of research (interviewing users, experts, roleplays…)"]},
                    {"title": "Asking the Right Questions", "topics": ["Mom Test", "Symptoms and disease"]},
                    {"title": "Reframing Your Problem", "topics": ["Current problem framing", "Principles of a good problem framing", "Process of reframing", "Stories of reframing: Protovillage, Invisible bike helmet"]}
                ]
            },
            {
                "title": "Making Constellations",
                "lessons": [
                    {"title": "What Makes a Great Insight", "topics": ["Good insight criteria", "How to distinguish between good data and bad?"]},
                    {"title": "Organizing Your Data", "topics": ["Unlocking Hidden Insights", "Steps to Make Sense of Your Data", "Ways to organise data systems", "Useful tips to build a sustainable system"]}
                ]
            },
            {
                "title": "Iceberg Model",
                "lessons": [
                    {"title": "What is an Iceberg Model?", "topics": ["What is an Iceberg model?", "What are the parts of the iceberg", "Getting to the root of the problem"]},
                    {"title": "Community Challenge", "content": "community_challenge"}
                ]
            },
            {
                "title": "Eco-Spotlight",
                "lessons": [
                    {"title": "Your Planet-Positivity Corner", "topics": ["Light case study — Environmental Problem-Solving skill", "Reflection questions", "Call to action to share reflections online with #PlanetPositivity"]}
                ]
            },
            {
                "title": "Checkpoint 3: Your Iceberg Model for User Insights",
                "lessons": [
                    {"title": "Checkpoint 3", "topics": ["Identify who's your target audience", "Collect user insights", "Map them on Iceberg Model", "Using these findings create user persona"], "lean_canvas": "Target Audience"}
                ]
            },
            {
                "title": "Closing",
                "lessons": [
                    {"title": "Module Summary", "content": "summary"},
                    {"title": "Additional Resources", "content": "resources"},
                    {"title": "Feedback Survey", "content": "survey"}
                ]
            }
        ]
    },
    3: {
        "name": "New Module 3: FOCUS — From Solution Ideation to a Clear Project Vision",
        "phase": "Focus",
        "time": "1 hour",
        "learning_goals": [
            "Apply creative problem-solving techniques to generate and validate innovative ideas.",
            "Identify personal limitations and reframe them as opportunities for growth in your projects.",
            "Craft a compelling project vision statement that connects your \"why\" to actionable solutions."
        ],
        "checkpoint": "Checkpoint 4: Project Vision Statement",
        "lean_canvas": "Solution & Value, Your Speed Bumps",
        "sections": [
            {
                "title": "Arrival",
                "lessons": [
                    {
                        "title": "Welcome to Module 3",
                        "content": "welcome",
                        "checklist": [
                            "Unit 1: Identify your limitations exercise",
                            "Unit 2: Community Challenge",
                            "Eco-Spotlight: Case reflection",
                            "Checkpoint 4: Your Project Vision Statement"
                        ],
                        "roadmap": [
                            ("Arrival", "You're here! Start by understanding the learning goals and completing a short ritual."),
                            ("Unit 1: Unlocking Creativity", "Explore creative problem-solving, practice ideation techniques, and learn how to turn personal limitations into opportunities for growth."),
                            ("Unit 2: Crafting Your Vision", "Learn how to define a strong project vision, connect it to your \"why,\" and draw inspiration from real-world vision statements."),
                            ("Eco-Spotlight", "Pause to reflect on the unintended consequences of innovation."),
                            ("Checkpoint 4", "Apply everything you've learned by drafting your own Project Vision Statement."),
                            ("Closing", "Review your achieved learning goals, access additional resources, and share useful materials with other fellows!")
                        ]
                    },
                    {"title": "Our Ritual", "content": "ritual"}
                ]
            },
            {
                "title": "Unlocking Creativity",
                "lessons": [
                    {"title": "Creative Problem Solving", "topics": ["What is creative problem-solving", "Creative problem solving mindset", "Principles of creative problem-solving"]},
                    {"title": "Ideating the Solution", "topics": ["Ideation techniques", "How might we… question", "How to filter ideas (ideas validation)", "Case-based tasks to practice ideas ideation and validation"]},
                    {"title": "Personal Limitations", "topics": ["Types and examples of personal limitations", "How to identify your limitations and speed bumps", "How to transform them into opportunities"]}
                ]
            },
            {
                "title": "Crafting Your Vision",
                "lessons": [
                    {"title": "Project Vision 101", "topics": ["What is Vision statement", "Vision vs mission", "How does your Why relate to the vision", "Real projects visions examples"]},
                    {"title": "Community Challenge", "content": "community_challenge"}
                ]
            },
            {
                "title": "Eco-Spotlight",
                "lessons": [
                    {"title": "Unintended Consequences", "topics": ["How to consider negative consequences of the project", "Case study", "Reflection question"]}
                ]
            },
            {
                "title": "Checkpoint 4: Your Project Vision Statement",
                "lessons": [
                    {"title": "Checkpoint 4", "topics": ["Draft a Project Vision Statement using a template", "Keep in mind personal limitations + project sandbox"], "lean_canvas": "Solution & Value, Your Speed Bumps"}
                ]
            },
            {
                "title": "Closing",
                "lessons": [
                    {"title": "Module Summary", "content": "summary"},
                    {"title": "Additional Resources", "content": "resources"},
                    {"title": "Feedback Survey", "content": "survey"}
                ]
            }
        ]
    },
    4: {
        "name": "New Module 4: FOCUS — Prototyping 101",
        "phase": "Focus",
        "time": "1.5 hours",
        "learning_goals": [
            "Design a prototype that aligns with your goals, audience, and available resources.",
            "Test your assumptions through user feedback and early adopter engagement to refine your solution.",
            "Apply sustainable design principles to ensure your prototype contributes to both innovation and environmental impact."
        ],
        "checkpoint": "Checkpoint 5: Envisioning Your Prototype",
        "lean_canvas": "Early Adopters, Prototype",
        "sections": [
            {
                "title": "Arrival",
                "lessons": [
                    {
                        "title": "Welcome to Module 4",
                        "content": "welcome",
                        "checklist": [
                            "Unit 1: Your Low-Fidelity Prototype in 7 min",
                            "Unit 2: Community Challenge",
                            "Eco-Spotlight: Case reflection",
                            "Checkpoint 5: Envisioning Your Prototype"
                        ],
                        "roadmap": [
                            ("Arrival", "You're here! Start by understanding the learning goals and completing a short ritual."),
                            ("Unit 1: Crafting Your Prototype", "Learn what a prototype is, why it matters, and how to bring your idea to life through the right tools, methods, and best practices."),
                            ("Unit 2: Shaping Solutions Through Feedback", "Discover how to test your assumptions, engage early adopters, and use user feedback to refine and improve your solution."),
                            ("Eco-Spotlight", "Explore sustainable design principles through real-world examples."),
                            ("Checkpoint 5", "Envision your prototype by applying what you've learned and mapping out the first version of your solution."),
                            ("Closing", "Review your achieved learning goals, access additional resources, and share useful materials with other fellows!")
                        ]
                    },
                    {"title": "Our Ritual", "content": "ritual"}
                ]
            },
            {
                "title": "Crafting Your Prototype",
                "lessons": [
                    {"title": "Jumpstart Your Prototyping Journey", "topics": ["What is a prototype", "Why prototype is important and needed for your project"]},
                    {"title": "Prototyping Tools and Methods", "topics": ["Prototyping methods", "Types of prototypes (low/high fidelity)", "Tools and how to choose the right tool"]},
                    {"title": "How to Prototype Well", "topics": ["Mistakes to avoid", "Best practices and what questions your prototype should answer", "When is a prototype \"good enough\" to move forward?"]},
                    {"title": "Lessons from Fellows' Projects", "topics": ["Successful prototyping — Visioneers examples"]}
                ]
            },
            {
                "title": "Shaping Solutions Through Feedback",
                "lessons": [
                    {"title": "User Feedback as a Decision Driver", "topics": ["Purpose of prototype testing (assumptions validation)", "Testing methods", "From assumption to testable hypotheses"]},
                    {"title": "Early Adopters", "topics": ["Who are early adopters and why it's valuable to work with them", "How to identify them", "How to engage them", "What feedback to gather"]},
                    {"title": "Community Challenge", "content": "community_challenge"}
                ]
            },
            {
                "title": "Eco-Spotlight",
                "lessons": [
                    {"title": "Planet-Positivity Corner: Sustainable Design Principles", "topics": ["Sustainable Design Principles case study"]}
                ]
            },
            {
                "title": "Checkpoint 5: Envisioning Your Prototype",
                "lessons": [
                    {"title": "Checkpoint 5", "topics": ["Submit a vision for the first prototype", "Define who your early adopters are"], "lean_canvas": "Early Adopters, Prototype"}
                ]
            },
            {
                "title": "Closing",
                "lessons": [
                    {"title": "Module Summary", "content": "summary"},
                    {"title": "Additional Resources", "content": "resources"},
                    {"title": "Feedback Survey", "content": "survey"}
                ]
            }
        ]
    },
    5: {
        "name": "New Module 5: PLAN — Your Prototyping Journey So Far",
        "phase": "Plan",
        "time": "30 min",
        "learning_goals": [
            "Reflect on your prototype to uncover insights and guide future improvements.",
            "Capture key lessons learned and apply them to refine your project.",
            "Recognize and reframe assumptions and personal limitations to strengthen your solution."
        ],
        "checkpoint": "Checkpoint 6: Prototyping Chronicles",
        "lean_canvas": "Prototype",
        "sections": [
            {
                "title": "Arrival",
                "lessons": [
                    {
                        "title": "Welcome to Module 5",
                        "content": "welcome",
                        "checklist": [
                            "Unit 1: Time to Act exercise",
                            "Unit 2: Community Challenge",
                            "Checkpoint 6: Prototyping Chronicles"
                        ],
                        "roadmap": [
                            ("Arrival", "You're here! Start by understanding the learning goals and completing a short ritual."),
                            ("Unit 1: Mid-Program Reflection", "Explore reflection tools, gather lessons learned from your first prototype, and collect peer feedback to guide improvements."),
                            ("Unit 2: Your Learning Curve", "Revisit assumptions and personal limitations, uncover hidden insights, and explore how challenges can become opportunities for growth."),
                            ("Checkpoint 6", "Demonstrate one failure that brought you closer to a refined solution, reflect on lessons learned, and revisit personal limitations."),
                            ("Closing", "Review your achieved learning goals, access additional resources, and share useful materials with other fellows!")
                        ]
                    },
                    {"title": "Our Ritual", "content": "ritual"}
                ]
            },
            {
                "title": "Mid-Program Reflection",
                "lessons": [
                    {"title": "Mapping Your Prototyping Journey", "topics": ["Why reflect on your prototype?", "Guiding questions for reflection on different areas of the project"]},
                    {"title": "Revisiting Assumptions and Limitations", "topics": ["Different types of assumptions", "Steps to revisit your assumptions", "Examples of personal limitations", "Assumptions about yourself"]},
                    {"title": "Community Challenge", "content": "community_challenge"}
                ]
            },
            {
                "title": "Checkpoint 6: Prototyping Chronicles",
                "lessons": [
                    {"title": "Checkpoint 6", "topics": ["Demonstrate one failure that helped you get closer to the refined solution", "Reflect on the lessons learnt and what has to be done differently", "Revisit your personal limitations and reflect on what needs to be changed"], "lean_canvas": "Prototype"}
                ]
            },
            {
                "title": "Closing",
                "lessons": [
                    {"title": "Module Summary", "content": "summary"},
                    {"title": "Additional Resources", "content": "resources"},
                    {"title": "Feedback Survey", "content": "survey"}
                ]
            }
        ]
    },
    6: {
        "name": "New Module 6: PLAN — Prototype Fine-tuning",
        "phase": "Plan",
        "time": "1 hour",
        "learning_goals": [
            "Revisit and refine your prototype using structured reflection and targeted improvements.",
            "Distinguish between prototypes and MVPs, and understand how prototyping supports MVP development.",
            "Apply lessons from real-world cases to strengthen your prototype and prepare for scaling your solution."
        ],
        "checkpoint": "Checkpoint 7: Prototype Refinement",
        "lean_canvas": "Prototype",
        "sections": [
            {
                "title": "Arrival",
                "lessons": [
                    {
                        "title": "Welcome to Module 6",
                        "content": "welcome",
                        "checklist": [
                            "Unit 1: Exercise: Create Your Refinement Plan",
                            "Unit 2: Community Challenge",
                            "Eco-Spotlight: Case Reflection",
                            "Checkpoint 7: Prototype Refinement towards Version 2"
                        ],
                        "roadmap": [
                            ("Arrival", "You're here! Start by understanding the learning goals and completing a short ritual."),
                            ("Unit 1: Refining your Prototype", "Dive into strategies to improve your first prototype. Learn how to analyze feedback, prioritize refinements, and plan practical next steps."),
                            ("Unit 2: Prototyping towards MVP", "Explore how refined prototypes evolve into MVPs. Discover what makes a minimum viable product successful and how the Delta 4 method can guide you."),
                            ("Eco-Spotlight", "Get inspired by a real-world case on circular economy principles."),
                            ("Checkpoint 7", "Identify your insights from reflection and describe how you'll apply them to refine your prototype."),
                            ("Closing", "Review your achieved learning goals, access additional resources, and share useful materials with other fellows!")
                        ]
                    },
                    {"title": "Our Ritual", "content": "ritual"}
                ]
            },
            {
                "title": "Refining Your Prototype",
                "lessons": [
                    {"title": "Why Refine Your Prototype", "topics": ["Why refine your prototype", "Guiding questions for refinement"]},
                    {"title": "Planning Refinements", "topics": ["How to prioritize refinements", "Prototype refinement plan", "Case — Max from Fainin video story"]},
                    {"title": "Why Prototypes Fail", "topics": ["Reasons why prototypes can fail", "Failed prototype case studies"]}
                ]
            },
            {
                "title": "Prototyping Towards MVP",
                "lessons": [
                    {"title": "MVP vs Prototype", "topics": ["What is MVP", "Difference from prototype", "Prototypes as a way to validate assumptions before building the MVP", "Successful MVP (MVP's principles, case study)"]},
                    {"title": "Delta 4 Method", "topics": ["What is Delta 4", "How does it help to create a great product"]},
                    {"title": "Community Challenge", "content": "community_challenge"}
                ]
            },
            {
                "title": "Eco-Spotlight",
                "lessons": [
                    {"title": "Planet-Positivity Corner: Circular Economy Concepts", "topics": ["A case on Circular Economy Concepts + reflective question"]}
                ]
            },
            {
                "title": "Checkpoint 7: Prototype Refinement",
                "lessons": [
                    {"title": "Checkpoint 7", "topics": ["What are the top three actionable insights from your reflection?", "How will you apply them to your prototype moving towards MVP?"], "lean_canvas": "Prototype"}
                ]
            },
            {
                "title": "Closing",
                "lessons": [
                    {"title": "Module Summary", "content": "summary"},
                    {"title": "Additional Resources", "content": "resources"},
                    {"title": "Feedback Survey", "content": "survey"}
                ]
            }
        ]
    },
    7: {
        "name": "New Module 7: PLAN — Your Story and Market Strategy",
        "phase": "Plan",
        "time": "1.5 hours",
        "learning_goals": [
            "Craft persuasive messages that make your eco-innovation clear and compelling.",
            "Use storytelling and audience insights to communicate in a way that resonates and drives engagement.",
            "Validate your market early and define a focused, evidence-based go-to-market strategy."
        ],
        "checkpoint": "Checkpoint 8: Your Go-To-Market Strategy",
        "lean_canvas": "Channels and Partnerships",
        "sections": [
            {
                "title": "Arrival",
                "lessons": [
                    {
                        "title": "Welcome to Module 7",
                        "content": "welcome",
                        "checklist": [
                            "Unit 1: Exercise: Craft Your Eco-Innovation Story",
                            "Unit 2: Set Your Market Validation Goal",
                            "Unit 3: Validate your Customer Personas with an AI Coach",
                            "Checkpoint 8: Draft your Go To Market Strategy"
                        ],
                        "roadmap": [
                            ("Arrival", "You're here! Start by understanding the learning goals and completing a short ritual."),
                            ("Unit 1: Strategic Communication", "Learn how to craft a clear message, structure information for clarity, and use storytelling to make your eco-innovation resonate."),
                            ("Unit 2: Market Validation Foundations", "Build a strong understanding of your target audience, create meaningful customer personas, and explore early validation techniques."),
                            ("Unit 3: Your Project Enablement", "Become one of the first users of our brand-new AI Coach and join a Community Challenge."),
                            ("Checkpoint 8", "Define your business model, identify channels, and outline the signals that will show you're on the right path."),
                            ("Closing", "Review your achieved learning goals, access additional resources, and share useful materials with other fellows!")
                        ]
                    },
                    {"title": "Our Ritual", "content": "ritual"}
                ]
            },
            {
                "title": "Strategic Communication",
                "lessons": [
                    {"title": "Crafting Your Key Message", "topics": ["How to craft your key message", "What makes your message persuasive", "What makes the message stick"]},
                    {"title": "Structuring Your Communication", "topics": ["The Inverted Pyramid for message structure", "How to communicate facts"]},
                    {"title": "The Power of Storytelling", "topics": ["Impact of storytelling", "Key concepts and elements of storytelling", "Steps to craft your eco-innovation story"]}
                ]
            },
            {
                "title": "Market Validation Foundations",
                "lessons": [
                    {"title": "Knowing Your Audience", "topics": ["Knowing your Target Audience", "5 Levels of awareness marketing", "Understanding what drives the customers", "Steps to create buying persona"]},
                    {"title": "Market Validation 101", "topics": ["What is market validation", "Difference between market validation and prototype", "Early validation techniques", "Defining Market Validation Goal", "Key metrics"]},
                    {"title": "Building Partnerships", "topics": ["How to make partnerships", "Partnerships case studies"]},
                    {"title": "Community Challenge", "content": "community_challenge"}
                ]
            },
            {
                "title": "Checkpoint 8: Your Go-To-Market Strategy",
                "lessons": [
                    {"title": "Checkpoint 8", "topics": ["What is your business model?", "Market channels (how will people discover your project?)", "How do you know you're successful?"], "lean_canvas": "Channels and Partnerships"}
                ]
            },
            {
                "title": "Closing",
                "lessons": [
                    {"title": "Module Summary", "content": "summary"},
                    {"title": "Additional Resources", "content": "resources"},
                    {"title": "Feedback Survey", "content": "survey"}
                ]
            }
        ]
    },
    8: {
        "name": "New Module 8: DO — Putting Together Your Budget and Impact",
        "phase": "Do",
        "time": "1.5 hours",
        "learning_goals": [
            "Define what meaningful impact means for your project and plan measurable KPIs to track progress.",
            "Build a solid financial foundation by planning budgets, costs, and revenue models that ensure long-term sustainability.",
            "Connect your impact goals with financial decisions to create a balanced, mission-driven growth strategy."
        ],
        "checkpoint": "Checkpoint 9: Impact Measurement Plan",
        "lean_canvas": "Key Metrics, Cost Structure, Income Streams",
        "sections": [
            {
                "title": "Arrival",
                "lessons": [
                    {
                        "title": "Welcome to Module 8",
                        "content": "welcome",
                        "checklist": [
                            "Unit 1: Participate in a Community Challenge",
                            "Unit 2: Plan for Stability Task",
                            "Checkpoint 9: Create your Impact Measurement Plan"
                        ],
                        "roadmap": [
                            ("Arrival", "You're here! Start by understanding the learning goals and completing a short ritual."),
                            ("Unit 1: Impact Measurement", "Clarify what real impact means for your project and learn how to translate your vision into clear, measurable indicators."),
                            ("Unit 2: Financial Management Foundations", "Turn your impact plan into a realistic financial strategy by aligning budgets, costs, and income for long-term sustainability."),
                            ("Checkpoint 9", "Bring impact and finances together to demonstrate a coherent, scholarship-ready project plan."),
                            ("Closing", "Review your achieved learning goals, access additional resources, and share useful materials with other fellows!")
                        ]
                    },
                    {"title": "Our Ritual", "content": "ritual"}
                ]
            },
            {
                "title": "Impact Measurement",
                "lessons": [
                    {"title": "What Makes Your Project Scholarship Ready?", "topics": ["What makes your project PS ready checklist", "What makes a good application (video)"]},
                    {"title": "Impact Planning", "topics": ["What do we consider as an Impact at bV", "Impact Planning and Impact KPIs"]},
                    {"title": "Community Challenge", "content": "community_challenge"}
                ]
            },
            {
                "title": "Financial Management Foundations",
                "lessons": [
                    {"title": "Budget Planning", "topics": ["Why do you need to plan a budget", "Mapping your resources", "Expense plan", "Cases with budget planning fails", "Creating a budget plan", "Budget template"]},
                    {"title": "Income Planning", "topics": ["Ways to keep running your project and generate revenue", "How to create a sustainable business model", "How to achieve long-term stability"]},
                    {"title": "Cost Planning", "topics": ["What are the costs to consider, types of costs", "What is value and how does it connect with the price", "The price formula + pricing mechanisms", "How impact adds value and helps justify your price"]}
                ]
            },
            {
                "title": "Checkpoint 9: Impact Measurement Plan",
                "lessons": [
                    {"title": "Checkpoint 9", "topics": ["Choose KPIs from Impact Planning section", "Answering Budget plan questions from PS Application"], "lean_canvas": "Key Metrics, Cost Structure, Income Streams"}
                ]
            },
            {
                "title": "Closing",
                "lessons": [
                    {"title": "Module Summary", "content": "summary"},
                    {"title": "Additional Resources", "content": "resources"},
                    {"title": "Feedback Survey", "content": "survey"}
                ]
            }
        ]
    }
}


# ─── HTML GENERATION ───

def generate_welcome_html(module):
    """Generate the Welcome lesson HTML."""
    welcome_lesson = module["sections"][0]["lessons"][0]

    # Intro
    html = f"""<p>Welcome, Visioneer! 🌍</p>
<p>⏱ Estimated completion time: {module['time']}</p>
<p>📩 Your feedback matters! Please complete the mandatory feedback survey at the end of the module.</p>
<p>🏅 Earn a badge when you complete the module!</p>
<hr>

<h2>Module Journey</h2>
<p>Here's what you can expect and how the learning unfolds throughout this module:</p>
<ol>
"""
    for label, desc in welcome_lesson.get("roadmap", []):
        html += f"<li><strong>{label}</strong> — {desc}</li>\n"
    html += "</ol>\n<hr>\n"

    # Learning goals
    html += "<h2>Learning Goals</h2>\n<p>By the end of this module, you will be able to:</p>\n<ol>\n"
    for goal in module["learning_goals"]:
        html += f"<li>{goal}</li>\n"
    html += "</ol>\n<hr>\n"

    # Checklist
    html += "<h2>Module Tasks Checklist</h2>\n<p>By the end of the module, you should have completed:</p>\n<ul>\n"
    for item in welcome_lesson.get("checklist", []):
        html += f"<li>☐ {item}</li>\n"
    html += "</ul>\n<hr>\n"

    # Lean Canvas
    html += f"<h2>Lean Canvas</h2>\n<p>This module will support you in completing the <strong>{module['lean_canvas']}</strong> section(s) of the Canvas.</p>\n<hr>\n"

    # How does this course work
    html += """<h2>How Does This Course Work?</h2>
<ul>
<li>Use the <strong>Continue buttons</strong> or the menu on the left to progress through the course.</li>
<li>All external links open in <strong>new tabs</strong> — no need to worry about losing your spot.</li>
<li>You don't have to complete everything at once — just remember where you left off and come back when you're ready!</li>
</ul>
<p><em>Your completion will be officially recorded once you submit the module survey.</em></p>
"""
    return html


def generate_ritual_html():
    return """<p>Join our three-step ritual to activate a focused mindset, ease stress, and set the stage for meaningful learning.</p>
<h3>Step 1: Activate Relevant Mindsets</h3>
<p><em>Flashcards: DOer Mindsets</em></p>
<h3>Step 2: Practice Mindfulness</h3>
<p><em>Interactive: Mindfulness Exercise</em></p>
<h3>Step 3: Own Your Learning</h3>
<p><em>Interactive: Learning Ownership Reflection</em></p>
"""


def generate_topic_lesson_html(lesson):
    """Generate HTML for a lesson with topics."""
    topics = lesson.get("topics", [])
    html = "<p>In this lesson, you'll explore:</p>\n<ul>\n"
    for t in topics:
        html += f"<li>{t}</li>\n"
    html += "</ul>\n"
    if lesson.get("lean_canvas"):
        html += f"\n<p><strong>Lean Canvas section:</strong> {lesson['lean_canvas']}</p>\n"
    return html


def generate_community_challenge_html():
    return "<p><em>Interactive: Community Challenge</em></p>\n<p>Participate in the community challenge and share your insights with fellow Visioneers.</p>\n"


def generate_summary_html():
    return "<p>Review the module checklist to confirm what you've completed.</p>\n<p><strong>Module Cheat Sheet:</strong> Key points to remember from this module.</p>\n"


def generate_resources_html():
    return """<p>Explore additional development resources on this module's topic:</p>
<ul>
<li>📖 What to Read</li>
<li>🎧 What to Hear</li>
<li>🎬 What to Watch</li>
</ul>
<p><em>Interactive: Share! (Would you like to share any useful resources with other fellows?)</em></p>
"""


def generate_survey_html():
    return "<p>Please complete the feedback survey to help us improve the learning experience.</p>\n<p><em>Interactive: Feedback Survey</em></p>\n"


def generate_lesson_html(lesson, module):
    """Route to correct HTML generator based on lesson content type."""
    content = lesson.get("content")
    if content == "welcome":
        return generate_welcome_html(module)
    elif content == "ritual":
        return generate_ritual_html()
    elif content == "community_challenge":
        return generate_community_challenge_html()
    elif content == "summary":
        return generate_summary_html()
    elif content == "resources":
        return generate_resources_html()
    elif content == "survey":
        return generate_survey_html()
    elif lesson.get("topics"):
        return generate_topic_lesson_html(lesson)
    else:
        return "<p>Content pending.</p>"


# ─── MAIN ───

def import_module(api, module_num):
    module = MODULES[module_num]
    print(f"\n{'='*60}")
    print(f"IMPORTING: {module['name']}")
    print(f"{'='*60}")

    total_lessons = sum(len(s["lessons"]) for s in module["sections"])
    print(f"  Sections: {len(module['sections'])}, Lessons: {total_lessons}")

    # Create course
    space = api.create_course(module["name"])
    space_id = space.get("id")
    time.sleep(0.5)

    results = {"space_id": space_id, "name": module["name"], "sections": []}

    for section in module["sections"]:
        sec = api.create_section(space_id, section["title"])
        section_id = sec.get("id")
        time.sleep(0.3)

        sec_result = {"id": section_id, "name": section["title"], "lessons": []}

        for lesson in section["lessons"]:
            body_html = generate_lesson_html(lesson, module)
            les = api.create_lesson(section_id, lesson["title"], body_html)
            time.sleep(0.3)

            sec_result["lessons"].append({
                "id": les.get("id"),
                "name": lesson["title"]
            })

        results["sections"].append(sec_result)

    return results


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--modules", type=str, default="2,3,4,5,6,7,8",
                       help="Comma-separated module numbers to import")
    args = parser.parse_args()

    with open("/Users/alen/.openclaw/.secrets/circle-api.json") as f:
        token = json.loads(f.read())["token"]

    api = CircleAPI(token, dry_run=args.dry_run)
    module_nums = [int(x.strip()) for x in args.modules.split(",")]

    all_results = {}
    for num in module_nums:
        if num not in MODULES:
            print(f"Module {num} not defined, skipping")
            continue
        result = import_module(api, num)
        all_results[num] = result

    # Save log
    log_path = "/Users/alen/.openclaw/workspace/rise-migration/new-modules-import-log.json"
    with open(log_path, "w") as f:
        json.dump(all_results, f, indent=2)

    print(f"\n{'='*60}")
    print(f"DONE! All modules imported as DRAFT.")
    print(f"Total API calls: {api.call_count}")
    print(f"Import log: {log_path}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
