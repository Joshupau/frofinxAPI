const pageOptions = (page: string, limit: string) => {
  const pageOptions = {
    limit: parseInt(limit) || 10,
    page: parseInt(page) || 0,
    skip: (parseInt(page) || 0) * (parseInt(limit) || 10)
  };
  return pageOptions;
};

export { pageOptions };