import { expect } from 'chai';
//@ts-ignore
import ENS from '@ensdomains/ensjs';
import HRE, { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ENSRegistry, ENSLabelBooker } from '../types';
//@ts-ignore
import nameHash from 'eth-ens-namehash';
import { expectEvent, evmSnapshot, evmRevert } from './helpers';
import { DeployedEns, DeployedLabelBooker } from '../tasks';

describe('ENS Label Booker', () => {
  const getLabelhash = (label: string) =>
    ethers.utils.keccak256(ethers.utils.toUtf8Bytes(label));

  let otherSigner: SignerWithAddress;
  let unknownSigner: SignerWithAddress;

  const sismoLabel = 'sismo';

  let registry: ENSRegistry;
  let ensLabelBooker: ENSLabelBooker;

  let snapshotId: string;

  before(async () => {
    const deployedENS: DeployedEns = await HRE.run('deploy-ens-full');
    ({ registry } = deployedENS);

    const deployedEnsDao: DeployedLabelBooker = await HRE.run(
      'deploy-label-booker',
      {
        ens: registry.address,
        name: sismoLabel,
      }
    );
    ({ ensLabelBooker } = deployedEnsDao);
    [, otherSigner, unknownSigner] = await HRE.ethers.getSigners();

    snapshotId = await evmSnapshot(HRE);
  });

  afterEach(async () => {
    await evmRevert(HRE, snapshotId);
    snapshotId = await evmSnapshot(HRE);
  });

  const label0 = getLabelhash('testlabel');
  const label1 = getLabelhash('anotherlabel');
  const label2 = getLabelhash('yetanotherlabel');
  const labels = [label0, label1, label2];

  const domain0 = `${label0}.${sismoLabel}.eth`;
  const userNode0 = nameHash.hash(domain0);

  const nodes = labels.map((label) =>
    nameHash.hash(`${label}.${sismoLabel}.eth`)
  );

  it(`Owner can book a label`, async () => {
    const tx = await ensLabelBooker.book(label0, unknownSigner.address);
    const receipt = await tx.wait();

    expectEvent(
      receipt,
      'NameBooked',
      (args) =>
        args.id.toHexString() === userNode0 &&
        args.bookingAddress === unknownSigner.address
    );

    expect(await ensLabelBooker.getBooking(label0)).to.equal(
      unknownSigner.address
    );
  });

  it(`Owner can not book an already booked label`, async () => {
    await ensLabelBooker.book(label0, unknownSigner.address);
    await expect(
      ensLabelBooker.book(label0, unknownSigner.address)
    ).to.be.revertedWith('ENS_LABEL_BOOKER: LABEL_ALREADY_BOOKED');
  });

  it(`Owner can not book with a zero address`, async () => {
    await expect(
      ensLabelBooker.book(label0, ethers.constants.AddressZero)
    ).to.be.revertedWith('ENS_LABEL_BOOKER: INVALID_BOOKING_ADDRESS');
  });

  it(`Owner can book multiple labels by batch`, async () => {
    const tx = await ensLabelBooker.batchBook(labels, [
      unknownSigner.address,
      unknownSigner.address,
      unknownSigner.address,
    ]);
    const receipt = await tx.wait();

    expectEvent(
      receipt,
      'NameBooked',
      (args) =>
        args.bookingAddress === unknownSigner.address &&
        args.id.toHexString() === nodes[0]
    );
    expectEvent(
      receipt,
      'NameBooked',
      (args) =>
        args.bookingAddress === unknownSigner.address &&
        args.id.toHexString() === nodes[1]
    );
    expectEvent(
      receipt,
      'NameBooked',
      (args) =>
        args.bookingAddress === unknownSigner.address &&
        args.id.toHexString() === nodes[2]
    );

    expect(await ensLabelBooker.getBooking(labels[0])).to.equal(
      unknownSigner.address
    );
    expect(await ensLabelBooker.getBooking(labels[1])).to.equal(
      unknownSigner.address
    );
    expect(await ensLabelBooker.getBooking(labels[2])).to.equal(
      unknownSigner.address
    );
  });

  it(`Owner can update a booking`, async () => {
    await ensLabelBooker.book(label0, unknownSigner.address);
    const tx = await ensLabelBooker.updateBooking(label0, otherSigner.address);
    expectEvent(
      await tx.wait(),
      'BookingUpdated',
      (args) =>
        args.bookingAddress === otherSigner.address &&
        args.id.toHexString() === userNode0
    );
    expect(await ensLabelBooker.getBooking(label0)).to.equal(
      otherSigner.address
    );
  });

  it(`Owner can update bookings by batch`, async () => {
    await ensLabelBooker.batchBook(labels, [
      unknownSigner.address,
      unknownSigner.address,
      unknownSigner.address,
    ]);
    const tx = await ensLabelBooker.batchUpdateBooking(labels, [
      otherSigner.address,
      otherSigner.address,
      otherSigner.address,
    ]);
    const receipt = await tx.wait();
    expectEvent(
      receipt,
      'BookingUpdated',
      (args) =>
        args.bookingAddress === otherSigner.address &&
        args.id.toHexString() === nodes[0]
    );
    expectEvent(
      receipt,
      'BookingUpdated',
      (args) =>
        args.bookingAddress === otherSigner.address &&
        args.id.toHexString() === nodes[1]
    );
    expectEvent(
      receipt,
      'BookingUpdated',
      (args) =>
        args.bookingAddress === otherSigner.address &&
        args.id.toHexString() === nodes[2]
    );

    expect(await ensLabelBooker.getBooking(labels[0])).to.equal(
      otherSigner.address
    );
    expect(await ensLabelBooker.getBooking(labels[1])).to.equal(
      otherSigner.address
    );
    expect(await ensLabelBooker.getBooking(labels[2])).to.equal(
      otherSigner.address
    );
  });

  it(`Owner can delete a booking`, async () => {
    await ensLabelBooker.book(label0, unknownSigner.address);
    const tx = await ensLabelBooker.deleteBooking(label0);
    expectEvent(
      await tx.wait(),
      'BookingDeleted',
      (args) => args.id.toHexString() === userNode0
    );
    expect(await ensLabelBooker.getBooking(label0)).to.equal(
      ethers.constants.AddressZero
    );
  });
  it(`Owner can delete bookings by batch`, async () => {
    await ensLabelBooker.batchBook(labels, [
      unknownSigner.address,
      unknownSigner.address,
      unknownSigner.address,
    ]);
    const tx = await ensLabelBooker.batchDeleteBooking(labels);
    const receipt = await tx.wait();
    expectEvent(
      receipt,
      'BookingUpdated',
      (args) => args.id.toHexString() === nodes[0]
    );
    expectEvent(
      receipt,
      'BookingUpdated',
      (args) => args.id.toHexString() === nodes[1]
    );
    expectEvent(
      receipt,
      'BookingUpdated',
      (args) => args.id.toHexString() === nodes[2]
    );
  });
});
