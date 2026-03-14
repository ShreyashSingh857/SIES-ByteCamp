// Initial mock data for Help API until a database model is connected
const mockHelpTopics = [
  {
    id: "1",
    title: "How do I register for an event?",
    content: "To register, go to the Events page, click on the specific ByteCamp event you want to join, and click the 'Register' button. Make sure you are logged in.",
    category: "Registration",
  },
  {
    id: "2",
    title: "I forgot my password. How can I reset it?",
    content: "Click on the 'Forgot Password' link on the login page. Enter your registered email address, and we will send you instructions on how to reset your password.",
    category: "Account",
  },
  {
    id: "3",
    title: "How do I contact support?",
    content: "You can reach out to our ByteCamp support team via email at support@sies-bytecamp.edu or use our live chat feature located at the bottom right of the screen.",
    category: "Support",
  },
];

/**
 * @desc    Get all help topics
 * @route   GET /api/help
 * @access  Public
 */
export const getHelpTopics = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      count: mockHelpTopics.length,
      data: mockHelpTopics,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search help topics by keyword
 * @route   GET /api/help/search?q=keyword
 * @access  Public
 */
export const searchHelp = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Please provide a search query keyword (e.g., ?q=password)",
      });
    }

    const keyword = q.toLowerCase();
    const results = mockHelpTopics.filter(
      (topic) =>
        topic.title.toLowerCase().includes(keyword) ||
        topic.content.toLowerCase().includes(keyword)
    );

    res.status(200).json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a specific help topic by ID
 * @route   GET /api/help/:id
 * @access  Public
 */
export const getHelpTopicById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const topic = mockHelpTopics.find((t) => t.id === id);

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: `Help topic not found with id of ${id}`,
      });
    }

    res.status(200).json({
      success: true,
      data: topic,
    });
  } catch (error) {
    next(error);
  }
};
