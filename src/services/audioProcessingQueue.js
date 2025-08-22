/**
 * Audio Processing Queue Service
 * Simple in-memory queue for managing asynchronous audio processing tasks
 */

// Simple in-memory queue implementation
const queue = [];
let isProcessing = false;
const MAX_CONCURRENT_TASKS = 2; // Limit concurrent processing tasks
let activeTasks = 0;

/**
 * Add a new audio processing task to the queue
 * @param {Function} processingFunction - The function to execute
 * @param {Array} args - Arguments to pass to the processing function
 * @returns {Promise} - Promise that resolves when the task is completed
 */
const addToQueue = (processingFunction, args) => {
  return new Promise((resolve, reject) => {
    const task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      processingFunction,
      args,
      resolve,
      reject,
      addedAt: new Date()
    };
    
    console.log(`🔄 Adding task ${task.id} to audio processing queue`);
    queue.push(task);
    processQueue();
  });
};

/**
 * Process the next items in the queue
 */
const processQueue = async () => {
  // If already processing or no tasks in queue, return
  if (activeTasks >= MAX_CONCURRENT_TASKS || queue.length === 0) {
    return;
  }

  // Get the next task
  const task = queue.shift();
  activeTasks++;
  
  console.log(`⏳ Starting task ${task.id} (${queue.length} remaining in queue)`);
  
  try {
    // Execute the task
    const result = await task.processingFunction(...task.args);
    console.log(`✅ Completed task ${task.id}`);
    task.resolve(result);
  } catch (error) {
    console.error(`❌ Error in task ${task.id}:`, error);
    task.reject(error);
  } finally {
    activeTasks--;
    // Process next task if available
    processQueue();
  }
};

/**
 * Get the current queue status
 * @returns {Object} - Queue status information
 */
const getQueueStatus = () => {
  return {
    queueLength: queue.length,
    activeTasks,
    maxConcurrentTasks: MAX_CONCURRENT_TASKS
  };
};

module.exports = {
  addToQueue,
  getQueueStatus
};
