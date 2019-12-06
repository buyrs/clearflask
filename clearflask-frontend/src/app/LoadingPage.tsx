import React, { Component } from 'react';
import Message from './comps/Message';
import Loading from './utils/Loading';
import { Box } from '@material-ui/core';

export default class LoadingPage extends Component {
  render() {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        width='100%'
        height='100vh'
      >
        <Loading />
      </Box>
    );
  }
}
